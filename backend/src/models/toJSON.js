/** Serialização comum: expõe `id` e oculta `_id`/`__v`. */
export default {
  versionKey: false,
  transform: (_doc, ret) => {
    ret.id = ret._id;
    delete ret._id;
    return ret;
  },
};
