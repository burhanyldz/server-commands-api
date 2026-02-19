import { model, Schema, type InferSchemaType } from 'mongoose';

export const COMMAND_SHELLS = ['cmd', 'powershell', 'bash'] as const;
export type CommandShell = (typeof COMMAND_SHELLS)[number];

const commandSchema = new Schema(
  {
    label: {
      type: String,
      required: true,
      trim: true
    },
    command: {
      type: String,
      required: true,
      trim: true
    },
    shell: {
      type: String,
      enum: COMMAND_SHELLS,
      default: 'cmd'
    },
    runAsSystem: {
      type: Boolean,
      default: true
    },
    timeoutMs: {
      type: Number
    },
    enabled: {
      type: Boolean,
      default: true
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'SCUser'
    }
  },
  {
    timestamps: true,
    collection: 'sc_commands'
  }
);

commandSchema.index({ label: 1 });

export type CommandDocument = InferSchemaType<typeof commandSchema> & {
  _id: Schema.Types.ObjectId;
};

const CommandModel = model('SCCommand', commandSchema);

export default CommandModel;
