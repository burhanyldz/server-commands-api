import { model, Schema, type InferSchemaType } from 'mongoose';
import { COMMAND_SHELLS } from './command.model.js';

const commandRunStepSchema = new Schema(
  {
    commandId: {
      type: Schema.Types.ObjectId,
      ref: 'SCCommand'
    },
    label: {
      type: String,
      required: true
    },
    command: {
      type: String,
      required: true
    },
    order: {
      type: Number,
      required: true
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
    timeoutMs: Number,
    completed: {
      type: Boolean,
      default: false
    },
    completedAt: Date,
    error: {
      type: Boolean,
      default: false
    },
    log: String
  },
  {
    _id: false
  }
);

const commandRunSchema = new Schema(
  {
    name: {
      type: String,
      trim: true
    },
    directoryId: {
      type: Schema.Types.ObjectId,
      ref: 'SCDirectory',
      required: true
    },
    directoryLabel: {
      type: String,
      required: true
    },
    directoryPath: {
      type: String,
      required: true
    },
    templateId: {
      type: Schema.Types.ObjectId,
      ref: 'SCChainTemplate'
    },
    templateName: {
      type: String,
      trim: true
    },
    steps: {
      type: [commandRunStepSchema],
      default: []
    },
    completed: {
      type: Boolean,
      default: false
    },
    error: {
      type: Boolean,
      default: false
    },
    completedAt: Date,
    failedStep: String,
    addDate: {
      type: Date,
      default: () => new Date()
    },
    processing: {
      type: Boolean,
      default: false
    },
    processingStartedAt: Date,
    errorMessage: String,
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'SCUser'
    }
  },
  {
    timestamps: true,
    collection: 'sc_command_runs'
  }
);

commandRunSchema.index({ addDate: -1 });
commandRunSchema.index({ completed: 1, processing: 1, processingStartedAt: 1 });
commandRunSchema.index({ directoryId: 1, addDate: -1 });

export type CommandRunDocument = InferSchemaType<typeof commandRunSchema> & {
  _id: Schema.Types.ObjectId;
};

const CommandRunModel = model('SCCommandRun', commandRunSchema);

export default CommandRunModel;
