import { Types } from 'mongoose';
import { z } from 'zod';
import CommandModel, { COMMAND_SHELLS, type CommandShell } from '../models/command.model.js';

export interface CommandStepSnapshot {
  commandId?: Types.ObjectId;
  label: string;
  command: string;
  order: number;
  shell: CommandShell;
  runAsSystem: boolean;
  timeoutMs?: number;
}

const inlineCommandSchema = z.object({
  label: z.string().trim().min(1),
  command: z.string().trim().min(1),
  shell: z.enum(COMMAND_SHELLS).optional(),
  runAsSystem: z.boolean().optional(),
  timeoutMs: z.number().int().positive().optional()
});

const commandStepInputSchema = z
  .object({
    order: z.number().int().positive().optional(),
    commandId: z.string().trim().optional(),
    label: z.string().trim().optional(),
    command: z.string().trim().optional(),
    shell: z.enum(COMMAND_SHELLS).optional(),
    runAsSystem: z.boolean().optional(),
    timeoutMs: z.number().int().positive().optional()
  })
  .superRefine((value, context) => {
    if (value.commandId) {
      return;
    }

    const parsedInline = inlineCommandSchema.safeParse(value);
    if (!parsedInline.success) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Each step needs either a valid commandId or an inline label+command.'
      });
    }
  });

export const commandStepsInputSchema = z.array(commandStepInputSchema).min(1);

interface ResolveStepOptions {
  allowInline: boolean;
}

const ensureUniqueOrder = (steps: CommandStepSnapshot[]): void => {
  const seen = new Set<number>();
  for (const step of steps) {
    if (seen.has(step.order)) {
      throw new Error(`Duplicate step order detected: ${step.order}`);
    }
    seen.add(step.order);
  }
};

export const resolveCommandSteps = async (
  inputs: z.infer<typeof commandStepsInputSchema>,
  options: ResolveStepOptions
): Promise<CommandStepSnapshot[]> => {
  const commandIds = inputs
    .map((step) => step.commandId)
    .filter((value): value is string => Boolean(value));

  const uniqueCommandIds = [...new Set(commandIds)];

  const commands =
    uniqueCommandIds.length === 0
      ? []
      : await CommandModel.find({
          _id: { $in: uniqueCommandIds },
          enabled: true
        }).lean();

  const commandMap = new Map(commands.map((command) => [String(command._id), command]));

  const snapshots: CommandStepSnapshot[] = inputs.map((step, index) => {
    const order = step.order ?? index + 1;

    if (step.commandId) {
      if (!Types.ObjectId.isValid(step.commandId)) {
        throw new Error(`Invalid commandId: ${step.commandId}`);
      }

      const commandRecord = commandMap.get(step.commandId);
      if (!commandRecord) {
        throw new Error(`Command not found or disabled: ${step.commandId}`);
      }

      return {
        commandId: commandRecord._id,
        label: commandRecord.label,
        command: commandRecord.command,
        order,
        shell: commandRecord.shell,
        runAsSystem: commandRecord.runAsSystem,
        timeoutMs: commandRecord.timeoutMs ?? undefined
      };
    }

    if (!options.allowInline) {
      throw new Error('Inline commands are not allowed in this context.');
    }

    const parsedInline = inlineCommandSchema.parse(step);

    return {
      label: parsedInline.label,
      command: parsedInline.command,
      order,
      shell: parsedInline.shell ?? 'cmd',
      runAsSystem: parsedInline.runAsSystem ?? true,
      timeoutMs: parsedInline.timeoutMs
    };
  });

  const sorted = snapshots.sort((a, b) => a.order - b.order);
  ensureUniqueOrder(sorted);
  return sorted;
};
