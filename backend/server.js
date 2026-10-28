
import dns from 'dns';
dns.setServers(['8.8.8.8', '8.8.4.4']);
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import Movie from './Movie.js';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB Connected Successfully'))
  .catch((err) => console.error('MongoDB Connection Error:', err));

const sendResponse = (res, statusCode, success, message, data = null) => {
  return res.status(statusCode).json({ success, message, data });
};

// 1. ADD MOVIE
app.post('/api/movies', async (req, res) => {
  try {
    const { title, releaseYear, runtime } = req.body;
    const currentYear = new Date().getFullYear();

    if (releaseYear < 1950 || releaseYear > currentYear) {
      return sendResponse(res, 400, false, `Release year must be between 1950 and ${currentYear}`);
    }
    if (runtime < 30 || runtime > 300) {
      return sendResponse(res, 400, false, 'Runtime must be between 30 and 300 minutes');
    }

    const existing = await Movie.findOne({
      title: { $regex: new RegExp(`^${title.trim()}$`, 'i') },
      releaseYear
    });

    if (existing) {
      return sendResponse(res, 409, false, 'Movie with this title and release year already exists!');
    }

    const movie = new Movie(req.body);
    await movie.save();
    return sendResponse(res, 201, true, 'Movie added successfully', movie);
  } catch (error) {
    return sendResponse(res, 500, false, error.message);
  }
});

// 2. GET ALL MOVIES
app.get('/api/movies', async (req, res) => {
  try {
    const { status, genre, search, page = 1 } = req.query;
    const limit = 6;
    const query = {};

    if (status) query.status = status;
    if (genre) query.genre = genre;
    if (search) query.title = { $regex: search, $options: 'i' };

    const totalMovies = await Movie.countDocuments(query);
    const totalPages = Math.ceil(totalMovies / limit) || 1;

    let sortOptions = { createdAt: -1 };
    if (status === 'To Watch') {
      sortOptions = { priority: -1, createdAt: -1 };
    }

    const movies = await Movie.find(query)
      .sort(sortOptions)
      .skip((page - 1) * limit)
      .limit(limit);

    return sendResponse(res, 200, true, 'Movies fetched successfully', {
      movies,
      totalPages,
      currentPage: Number(page),
      totalMovies
    });
  } catch (error) {
    return sendResponse(res, 500, false, error.message);
  }
});

// 3. WATCH NEXT RECOMMENDATION
app.get('/api/movies/watch-next', async (req, res) => {
  try {
    const movie = await Movie.findOne({ status: 'To Watch' })
      .sort({ priority: -1, runtime: 1 });

    if (!movie) {
      return sendResponse(res, 404, false, 'No movies currently in "To Watch" status.');
    }

    return sendResponse(res, 200, true, 'Watch Next recommendation found', movie);
  } catch (error) {
    return sendResponse(res, 500, false, error.message);
  }
});

// 4. STATISTICS DASHBOARD
app.get('/api/movies/stats', async (req, res) => {
  try {
    const statsByStatus = await Movie.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    const statusCounts = { 'To Watch': 0, Watching: 0, Watched: 0 };
    statsByStatus.forEach(item => {
      statusCounts[item._id] = item.count;
    });

    const watchedStats = await Movie.aggregate([
      { $match: { status: 'Watched' } },
      {
        $group: {
          _id: null,
          totalRuntimeMins: { $sum: '$runtime' },
          avgRating: { $avg: '$rating' }
        }
      }
    ]);

    const totalHoursWatched = watchedStats[0]
      ? (watchedStats[0].totalRuntimeMins / 60).toFixed(1)
      : '0.0';

    const avgRating = watchedStats[0]
      ? watchedStats[0].avgRating.toFixed(1)
      : '0.0';

    const topGenreAgg = await Movie.aggregate([
      { $match: { status: 'Watched' } },
      { $group: { _id: '$genre', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 1 }
    ]);

    const topGenre = topGenreAgg.length > 0 ? topGenreAgg[0]._id : 'N/A';

    return sendResponse(res, 200, true, 'Stats retrieved successfully', {
      statusCounts,
      totalHoursWatched,
      avgRating,
      topGenre
    });
  } catch (error) {
    return sendResponse(res, 500, false, error.message);
  }
});

// 5. UPDATE MOVIE
app.put('/api/movies/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, rating, title, genre, runtime, platform, priority } = req.body;

    const existingMovie = await Movie.findById(id);
    if (!existingMovie) {
      return sendResponse(res, 404, false, 'Movie not found');
    }

    if (status && status !== existingMovie.status) {
      const current = existingMovie.status;

      if (current === 'Watched') {
        return sendResponse(res, 400, false, 'Watched status is final and cannot be changed.');
      }
      if (current === 'To Watch' && !['Watching', 'Watched'].includes(status)) {
        return sendResponse(res, 400, false, 'Invalid status transition from To Watch.');
      }
      if (current === 'Watching' && !['To Watch', 'Watched'].includes(status)) {
        return sendResponse(res, 400, false, 'Invalid status transition from Watching.');
      }

      if (status === 'Watched') {
        if (!rating || rating < 1 || rating > 10) {
          return sendResponse(res, 400, false, 'A rating between 1 and 10 is mandatory when moving to Watched!');
        }
        existingMovie.watchedDate = new Date();
        existingMovie.rating = rating;
      }

      existingMovie.status = status;
    }

    if (rating !== undefined && existingMovie.status !== 'Watched') {
      return sendResponse(res, 400, false, 'Rating can only be set for Watched movies.');
    } else if (rating !== undefined && existingMovie.status === 'Watched') {
      existingMovie.rating = rating;
    }

    if (title) existingMovie.title = title;
    if (genre) existingMovie.genre = genre;
    if (runtime) existingMovie.runtime = runtime;
    if (platform) existingMovie.platform = platform;
    if (priority) existingMovie.priority = priority;

    await existingMovie.save();
    return sendResponse(res, 200, true, 'Movie updated successfully', existingMovie);
  } catch (error) {
    return sendResponse(res, 500, false, error.message);
  }
});

// 6. DELETE MOVIE
app.delete('/api/movies/:id', async (req, res) => {
  try {
    const movie = await Movie.findById(req.params.id);
    if (!movie) {
      return sendResponse(res, 404, false, 'Movie not found');
    }

    if (movie.status === 'Watching') {
      return sendResponse(res, 400, false, 'Movies currently in "Watching" status cannot be deleted!');
    }

    await Movie.findByIdAndDelete(req.params.id);
    return sendResponse(res, 200, true, 'Movie deleted successfully');
  } catch (error) {
    return sendResponse(res, 500, false, error.message);
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));