import { type Request, type Response } from 'express';
import { z } from 'zod';
import { commandStepsInputSchema, resolveCommandSteps, type CommandStepSnapshot } from '../lib/command-step.js';
import ChainTemplateModel from '../models/chain-template.model.js';
import CommandRunModel from '../models/command-run.model.js';
import DirectoryModel from '../models/directory.model.js';

const createCommandRunSchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    directoryId: z.string().trim().optional(),
    templateId: z.string().trim().optional(),
    steps: commandStepsInputSchema.optional()
  })
  .superRefine((value, context) => {
    if (value.templateId && value.steps) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Provide either templateId or steps, not both.'
      });
      return;
    }

    if (!value.templateId) {
      if (!value.directoryId) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'directoryId is required for ad-hoc command runs.'
        });
      }

      if (!value.steps) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'steps are required for ad-hoc command runs.'
        });
      }
    }
  });

const stepToRunStep = (step: CommandStepSnapshot) => ({
  commandId: step.commandId,
  label: step.label,
  command: step.command,
  order: step.order,
  shell: step.shell,
  runAsSystem: step.runAsSystem,
  timeoutMs: step.timeoutMs,
  completed: false,
  completedAt: undefined,
  error: false,
  log: undefined
});

export const createCommandRun = async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = createCommandRunSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: 'Invalid command run payload.', details: parsed.error.flatten() });
      return;
    }

    const payload = parsed.data;

    let directoryId = payload.directoryId;
    let templateId: string | undefined;
    let templateName: string | undefined;
    let steps: CommandStepSnapshot[] = [];
    let runName = payload.name;

    if (payload.templateId) {
      const template = await ChainTemplateModel.findById(payload.templateId).lean();
      if (!template) {
        res.status(404).json({ message: 'Chain template not found.' });
        return;
      }

      templateId = String(template._id);
      templateName = template.name;
      directoryId = payload.directoryId ?? (template.directoryId ? String(template.directoryId) : undefined);

      if (!directoryId) {
        res.status(400).json({
          message: 'This template does not have a default directory. Provide directoryId explicitly.'
        });
        return;
      }

      if (!template.steps.length) {
        res.status(400).json({ message: 'Selected template has no steps.' });
        return;
      }

      steps = template.steps
        .map((step) => ({
          commandId: step.commandId ?? undefined,
          label: step.label,
          command: step.command,
          order: step.order,
          shell: step.shell,
          runAsSystem: step.runAsSystem,
          timeoutMs: step.timeoutMs ?? undefined
        }))
        .sort((a, b) => a.order - b.order);

      if (!runName) {
        runName = template.name;
      }
    } else {
      steps = await resolveCommandSteps(payload.steps ?? [], { allowInline: true });
    }

    const directory = await DirectoryModel.findById(directoryId).lean();
    if (!directory) {
      res.status(404).json({ message: 'Directory not found.' });
      return;
    }

    if (steps.length === 0) {
      res.status(400).json({ message: 'No executable steps found for this run.' });
      return;
    }

    const commandRun = await CommandRunModel.create({
      name: runName,
      directoryId: directory._id,
      directoryLabel: directory.label,
      directoryPath: directory.path,
      templateId,
      templateName,
      steps: steps.map(stepToRunStep),
      completed: false,
      error: false,
      addDate: new Date(),
      createdBy: req.auth?.userId
    });

    res.status(201).json(commandRun);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create command run.';
    res.status(500).json({ message });
  }
};

export const listCommandRuns = async (req: Request, res: Response): Promise<void> => {
  try {
    const skip = Number(req.query.skip ?? 0) || 0;
    const limit = Number(req.query.limit ?? 15) || 15;

    const [data, total] = await Promise.all([
      CommandRunModel.find({}).sort({ addDate: -1 }).skip(skip).limit(limit).lean(),
      CommandRunModel.countDocuments({})
    ]);

    res.status(200).json({ data, total });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to list command runs.';
    res.status(500).json({ message });
  }
};

export const getCommandRunById = async (req: Request, res: Response): Promise<void> => {
  try {
    const commandRun = await CommandRunModel.findById(req.params.id).lean();
    if (!commandRun) {
      res.status(404).json({ message: 'Command run not found.' });
      return;
    }

    res.status(200).json(commandRun);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get command run.';
    res.status(500).json({ message });
  }
};

export const retryCommandRun = async (req: Request, res: Response): Promise<void> => {
  try {
    const existing = await CommandRunModel.findById(req.params.id).lean();
    if (!existing) {
      res.status(404).json({ message: 'Command run not found.' });
      return;
    }

    const retryName = existing.name ? `${existing.name} (retry)` : existing.templateName ? `${existing.templateName} (retry)` : undefined;

    const retried = await CommandRunModel.create({
      name: retryName,
      directoryId: existing.directoryId,
      directoryLabel: existing.directoryLabel,
      directoryPath: existing.directoryPath,
      templateId: existing.templateId,
      templateName: existing.templateName,
      steps: existing.steps
        .slice()
        .sort((a, b) => a.order - b.order)
        .map((step) => ({
          commandId: step.commandId,
          label: step.label,
          command: step.command,
          order: step.order,
          shell: step.shell,
          runAsSystem: step.runAsSystem,
          timeoutMs: step.timeoutMs,
          completed: false,
          completedAt: undefined,
          error: false,
          log: undefined
        })),
      completed: false,
      error: false,
      addDate: new Date(),
      createdBy: req.auth?.userId
    });

    res.status(201).json(retried);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to retry command run.';
    res.status(500).json({ message });
  }
};

export const deleteCommandRun = async (req: Request, res: Response): Promise<void> => {
  try {
    const deleted = await CommandRunModel.findByIdAndDelete(req.params.id).lean();
    if (!deleted) {
      res.status(404).json({ message: 'Command run not found.' });
      return;
    }

    res.status(200).json({ message: 'Command run deleted successfully.' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete command run.';
    res.status(500).json({ message });
  }
};
