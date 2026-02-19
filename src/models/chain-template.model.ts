import { model, Schema, type InferSchemaType } from 'mongoose';
import { COMMAND_SHELLS } from './command.model.js';

const chainTemplateStepSchema = new Schema(
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
    timeoutMs: Number
  },
  {
    _id: false
  }
);

const chainTemplateSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      trim: true
    },
    directoryId: {
      type: Schema.Types.ObjectId,
      ref: 'SCDirectory'
    },
    steps: {
      type: [chainTemplateStepSchema],
      default: []
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'SCUser'
    }
  },
  {
    timestamps: true,
    collection: 'sc_chain_templates'
  }
);

chainTemplateSchema.index({ name: 1 });

export type ChainTemplateDocument = InferSchemaType<typeof chainTemplateSchema> & {
  _id: Schema.Types.ObjectId;
};

const ChainTemplateModel = model('SCChainTemplate', chainTemplateSchema);

export default ChainTemplateModel;
