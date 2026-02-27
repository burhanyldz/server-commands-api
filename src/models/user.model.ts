import { model, Schema, type InferSchemaType } from 'mongoose';

const userSchema = new Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },
    passwordHash: {
      type: String,
      required: true
    },
    role: {
      type: String,
      enum: ['admin', 'operator'],
      default: 'operator'
    },
    totpSecret: {
      type: String,
      default: null
    },
    totpEnabled: {
      type: Boolean,
      default: false
    },
    passkeys: {
      type: [
        {
          credentialID: { type: String, required: true },
          credentialPublicKey: { type: String, required: true },
          counter: { type: Number, required: true },
          deviceType: { type: String, default: 'singleDevice' },
          backedUp: { type: Boolean, default: false },
          transports: { type: [String], default: [] },
          name: { type: String, default: 'Passkey' },
          createdAt: { type: Date, default: Date.now }
        }
      ],
      default: []
    }
  },
  {
    timestamps: true,
    collection: 'sc_users'
  }
);

userSchema.index({ email: 1 }, { unique: true });

export type UserDocument = InferSchemaType<typeof userSchema> & {
  _id: Schema.Types.ObjectId;
};

const UserModel = model('SCUser', userSchema);

export default UserModel;
