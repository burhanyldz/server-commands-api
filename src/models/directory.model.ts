import { model, Schema, type InferSchemaType } from 'mongoose';

const directorySchema = new Schema(
  {
    label: {
      type: String,
      required: true,
      trim: true
    },
    path: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      trim: true
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'SCUser'
    }
  },
  {
    timestamps: true,
    collection: 'sc_directories'
  }
);

directorySchema.index({ path: 1 }, { unique: true });
directorySchema.index({ label: 1 });

export type DirectoryDocument = InferSchemaType<typeof directorySchema> & {
  _id: Schema.Types.ObjectId;
};

const DirectoryModel = model('SCDirectory', directorySchema);

export default DirectoryModel;
