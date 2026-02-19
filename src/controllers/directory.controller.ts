import { type Request, type Response } from 'express';
import { z } from 'zod';
import ChainTemplateModel from '../models/chain-template.model.js';
import CommandRunModel from '../models/command-run.model.js';
import DirectoryModel from '../models/directory.model.js';

const createDirectorySchema = z.object({
  label: z.string().trim().min(1),
  path: z.string().trim().min(1),
  description: z.string().trim().optional()
});

const updateDirectorySchema = z.object({
  label: z.string().trim().min(1).optional(),
  path: z.string().trim().min(1).optional(),
  description: z.string().trim().optional()
});

export const createDirectory = async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = createDirectorySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: 'Invalid directory payload.', details: parsed.error.flatten() });
      return;
    }

    const existing = await DirectoryModel.findOne({ path: parsed.data.path }).lean();
    if (existing) {
      res.status(409).json({ message: 'This directory path is already registered.' });
      return;
    }

    const directory = await DirectoryModel.create({
      ...parsed.data,
      createdBy: req.auth?.userId
    });

    res.status(201).json(directory);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create directory.';
    res.status(500).json({ message });
  }
};

export const listDirectories = async (_req: Request, res: Response): Promise<void> => {
  try {
    const directories = await DirectoryModel.find({}).sort({ label: 1, path: 1 }).lean();
    res.status(200).json({ data: directories });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to list directories.';
    res.status(500).json({ message });
  }
};

export const updateDirectory = async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = updateDirectorySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: 'Invalid update payload.', details: parsed.error.flatten() });
      return;
    }

    if (Object.keys(parsed.data).length === 0) {
      res.status(400).json({ message: 'Provide at least one field to update.' });
      return;
    }

    const updated = await DirectoryModel.findByIdAndUpdate(req.params.id, parsed.data, {
      new: true
    }).lean();

    if (!updated) {
      res.status(404).json({ message: 'Directory not found.' });
      return;
    }

    res.status(200).json(updated);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update directory.';
    res.status(500).json({ message });
  }
};

export const deleteDirectory = async (req: Request, res: Response): Promise<void> => {
  try {
    const [templateUsageCount, runUsageCount] = await Promise.all([
      ChainTemplateModel.countDocuments({ directoryId: req.params.id }),
      CommandRunModel.countDocuments({ directoryId: req.params.id })
    ]);

    if (templateUsageCount > 0 || runUsageCount > 0) {
      res.status(409).json({
        message: 'Directory is referenced by chain templates or command runs. Delete dependent records first.'
      });
      return;
    }

    const deleted = await DirectoryModel.findByIdAndDelete(req.params.id).lean();
    if (!deleted) {
      res.status(404).json({ message: 'Directory not found.' });
      return;
    }

    res.status(200).json({ message: 'Directory deleted successfully.' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete directory.';
    res.status(500).json({ message });
  }
};
