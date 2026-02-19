import { type Request, type Response } from 'express';
import { z } from 'zod';
import ChainTemplateModel from '../models/chain-template.model.js';
import CommandModel, { COMMAND_SHELLS } from '../models/command.model.js';

const createCommandSchema = z.object({
  label: z.string().trim().min(1),
  command: z.string().trim().min(1),
  shell: z.enum(COMMAND_SHELLS).optional(),
  runAsSystem: z.boolean().optional(),
  timeoutMs: z.number().int().positive().optional(),
  enabled: z.boolean().optional()
});

const updateCommandSchema = z.object({
  label: z.string().trim().min(1).optional(),
  command: z.string().trim().min(1).optional(),
  shell: z.enum(COMMAND_SHELLS).optional(),
  runAsSystem: z.boolean().optional(),
  timeoutMs: z.number().int().positive().optional(),
  enabled: z.boolean().optional()
});

export const createCommand = async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = createCommandSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: 'Invalid command payload.', details: parsed.error.flatten() });
      return;
    }

    const command = await CommandModel.create({
      ...parsed.data,
      shell: parsed.data.shell ?? 'cmd',
      runAsSystem: parsed.data.runAsSystem ?? true,
      enabled: parsed.data.enabled ?? true,
      createdBy: req.auth?.userId
    });

    res.status(201).json(command);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create command.';
    res.status(500).json({ message });
  }
};

export const listCommands = async (_req: Request, res: Response): Promise<void> => {
  try {
    const commands = await CommandModel.find({}).sort({ label: 1, command: 1 }).lean();
    res.status(200).json({ data: commands });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to list commands.';
    res.status(500).json({ message });
  }
};

export const updateCommand = async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = updateCommandSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: 'Invalid update payload.', details: parsed.error.flatten() });
      return;
    }

    if (Object.keys(parsed.data).length === 0) {
      res.status(400).json({ message: 'Provide at least one field to update.' });
      return;
    }

    const updated = await CommandModel.findByIdAndUpdate(req.params.id, parsed.data, {
      new: true
    }).lean();

    if (!updated) {
      res.status(404).json({ message: 'Command not found.' });
      return;
    }

    res.status(200).json(updated);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update command.';
    res.status(500).json({ message });
  }
};

export const deleteCommand = async (req: Request, res: Response): Promise<void> => {
  try {
    const templateUsageCount = await ChainTemplateModel.countDocuments({
      'steps.commandId': req.params.id
    });

    if (templateUsageCount > 0) {
      res.status(409).json({ message: 'Command is used by chain templates. Remove it from templates first.' });
      return;
    }

    const deleted = await CommandModel.findByIdAndDelete(req.params.id).lean();
    if (!deleted) {
      res.status(404).json({ message: 'Command not found.' });
      return;
    }

    res.status(200).json({ message: 'Command deleted successfully.' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete command.';
    res.status(500).json({ message });
  }
};
