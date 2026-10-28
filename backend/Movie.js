import mongoose from 'mongoose';

const currentYear = new Date().getFullYear();

const movieSchema = new mongoose.Schema({
  movieCode: { type: String, unique: true },
  title: { type: String, required: true, trim: true },
  genre: {
    type: String,
    required: true,
    enum: ['Action', 'Comedy', 'Drama', 'Horror', 'Sci-Fi', 'Romance', 'Thriller']
  },
  releaseYear: {
    type: Number,
    required: true,
    min: [1950, 'Year must be at least 1950'],
    max: [currentYear, `Year cannot exceed ${currentYear}`]
  },
  runtime: {
    type: Number,
    required: true,
    min: [30, 'Runtime must be at least 30 mins'],
    max: [300, 'Runtime cannot exceed 300 mins']
  },
  platform: {
    type: String,
    required: true,
    enum: ['Netflix', 'Prime Video', 'Hotstar', 'Theatre', 'Other']
  },
  priority: { type: Number, required: true, min: 1, max: 5 },
  status: {
    type: String,
    enum: ['To Watch', 'Watching', 'Watched'],
    default: 'To Watch'
  },
  rating: { type: Number, min: 1, max: 10, default: null },
  watchedDate: { type: Date, default: null }
}, { timestamps: true });

movieSchema.pre('save', async function (next) {
  if (this.isNew) {
    const count = await mongoose.model('Movie').countDocuments({ releaseYear: this.releaseYear });
    const sequence = String(count + 1).padStart(3, '0');
    this.movieCode = `MV-${this.releaseYear}-${sequence}`;
  }
  next();
});

export default mongoose.model('Movie', movieSchema);