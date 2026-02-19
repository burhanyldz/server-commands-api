import { type Request, type Response } from 'express';
import { z } from 'zod';
import { commandStepsInputSchema, resolveCommandSteps } from '../lib/command-step.js';
import DirectoryModel from '../models/directory.model.js';
import ChainTemplateModel from '../models/chain-template.model.js';

const createChainTemplateSchema = z.object({
  name: z.string().trim().min(1),
  description: z.string().trim().optional(),
  directoryId: z.string().trim().optional(),
  steps: commandStepsInputSchema
});

const updateChainTemplateSchema = z.object({
  name: z.string().trim().min(1).optional(),
  description: z.string().trim().optional(),
  directoryId: z.string().trim().nullable().optional(),
  steps: commandStepsInputSchema.optional()
});

export const createChainTemplate = async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = createChainTemplateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: 'Invalid chain template payload.', details: parsed.error.flatten() });
      return;
    }

    if (parsed.data.directoryId) {
      const directory = await DirectoryModel.findById(parsed.data.directoryId).lean();
      if (!directory) {
        res.status(400).json({ message: 'Selected directory was not found.' });
        return;
      }
    }

    const steps = await resolveCommandSteps(parsed.data.steps, { allowInline: true });

    const chainTemplate = await ChainTemplateModel.create({
      name: parsed.data.name,
      description: parsed.data.description,
      directoryId: parsed.data.directoryId,
      steps,
      createdBy: req.auth?.userId
    });

    res.status(201).json(chainTemplate);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create chain template.';
    res.status(500).json({ message });
  }
};

export const listChainTemplates = async (_req: Request, res: Response): Promise<void> => {
  try {
    const templates = await ChainTemplateModel.find({}).sort({ name: 1, createdAt: -1 }).lean();
    res.status(200).json({ data: templates });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to list chain templates.';
    res.status(500).json({ message });
  }
};

export const getChainTemplateById = async (req: Request, res: Response): Promise<void> => {
  try {
    const template = await ChainTemplateModel.findById(req.params.id).lean();
    if (!template) {
      res.status(404).json({ message: 'Chain template not found.' });
      return;
    }

    res.status(200).json(template);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get chain template.';
    res.status(500).json({ message });
  }
};

export const updateChainTemplate = async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = updateChainTemplateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: 'Invalid update payload.', details: parsed.error.flatten() });
      return;
    }

    const patch: Record<string, unknown> = {};

    if (parsed.data.name !== undefined) {
      patch.name = parsed.data.name;
    }

    if (parsed.data.description !== undefined) {
      patch.description = parsed.data.description;
    }

    if (parsed.data.directoryId !== undefined) {
      if (parsed.data.directoryId === null) {
        patch.directoryId = null;
      } else {
        const directory = await DirectoryModel.findById(parsed.data.directoryId).lean();
        if (!directory) {
          res.status(400).json({ message: 'Selected directory was not found.' });
          return;
        }

        patch.directoryId = parsed.data.directoryId;
      }
    }

    if (parsed.data.steps !== undefined) {
      patch.steps = await resolveCommandSteps(parsed.data.steps, { allowInline: true });
    }

    if (Object.keys(patch).length === 0) {
      res.status(400).json({ message: 'Provide at least one field to update.' });
      return;
    }

    const updated = await ChainTemplateModel.findByIdAndUpdate(req.params.id, patch, {
      new: true
    }).lean();

    if (!updated) {
      res.status(404).json({ message: 'Chain template not found.' });
      return;
    }

    res.status(200).json(updated);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update chain template.';
    res.status(500).json({ message });
  }
};

export const deleteChainTemplate = async (req: Request, res: Response): Promise<void> => {
  try {
    const deleted = await ChainTemplateModel.findByIdAndDelete(req.params.id).lean();
    if (!deleted) {
      res.status(404).json({ message: 'Chain template not found.' });
      return;
    }

    res.status(200).json({ message: 'Chain template deleted successfully.' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete chain template.';
    res.status(500).json({ message });
  }
};
