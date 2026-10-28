import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = 'http://localhost:5000/api/movies';

function App() {
  const [movies, setMovies] = useState([]);
  const [stats, setStats] = useState({ statusCounts: { 'To Watch': 0, Watching: 0, Watched: 0 } });
  const [form, setForm] = useState({
    title: '',
    genre: '',
    releaseYear: '',
    runtime: '',
    status: 'To Watch'
  });
  const [filter, setFilter] = useState('All');
  const [recommended, setRecommended] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    fetchMovies();
    fetchStats();
  }, [filter]);

  const fetchMovies = async () => {
    try {
      let url = API_URL;
      if (filter !== 'All') {
        url += `?status=${encodeURIComponent(filter)}`;
      }
      const res = await axios.get(url);
      if (res.data && res.data.success) {
        setMovies(res.data.data.movies || []);
      }
    } catch (err) {
      console.error('Error fetching movies:', err);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await axios.get(`${API_URL}/stats`);
      if (res.data && res.data.success) {
        setStats(res.data.data);
      }
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  };

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    const payload = {
      title: form.title,
      genre: form.genre,
      releaseYear: Number(form.releaseYear),
      runtime: Number(form.runtime),
      status: form.status
    };

    try {
      const res = await axios.post(API_URL, payload);
      if (res.data.success) {
        setForm({ title: '', genre: '', releaseYear: '', runtime: '', status: 'To Watch' });
        fetchMovies();
        fetchStats();
      }
    } catch (err) {
      if (err.response && err.response.data && err.response.data.message) {
        setErrorMsg(err.response.data.message);
      } else {
        setErrorMsg('Failed to add movie. Check your inputs.');
      }
    }
  };

  const handleStatusChange = async (id, newStatus) => {
    setErrorMsg('');
    let body = { status: newStatus };

    if (newStatus === 'Watched') {
      const rating = prompt('Please enter a rating between 1 and 10:');
      if (!rating || isNaN(rating) || Number(rating) < 1 || Number(rating) > 10) {
        alert('A valid rating between 1 and 10 is required when moving to Watched!');
        return;
      }
      body.rating = Number(rating);
    }

    try {
      const res = await axios.put(`${API_URL}/${id}`, body);
      if (res.data.success) {
        fetchMovies();
        fetchStats();
      }
    } catch (err) {
      if (err.response && err.response.data && err.response.data.message) {
        alert(err.response.data.message);
      }
    }
  };

  const handleDelete = async (id) => {
    setErrorMsg('');
    try {
      const res = await axios.delete(`${API_URL}/${id}`);
      if (res.data.success) {
        fetchMovies();
        fetchStats();
      }
    } catch (err) {
      if (err.response && err.response.data && err.response.data.message) {
        alert(err.response.data.message);
      }
    }
  };

  const getWatchNext = async () => {
    try {
      const res = await axios.get(`${API_URL}/watch-next`);
      if (res.data && res.data.success) {
        setRecommended(`${res.data.data.title} (${res.data.data.genre}) - ${res.data.data.runtime} mins`);
      }
    } catch (err) {
      if (err.response && err.response.data && err.response.data.message) {
        setRecommended(err.response.data.message);
      } else {
        setRecommended('No unwatched movies left in your list!');
      }
    }
  };

  const counts = stats.statusCounts || { 'To Watch': 0, Watching: 0, Watched: 0 };
  const totalCount = counts['To Watch'] + counts['Watching'] + counts['Watched'];

  return (
    <div style={{ maxWidth: '800px', margin: '30px auto', fontFamily: 'sans-serif', padding: '0 20px' }}>
      <h1>🎬 Movie Watchlist Manager</h1>

      {/* Stats Summary */}
      <div style={{ display: 'flex', gap: '15px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <div style={{ padding: '10px 20px', background: '#e3f2fd', borderRadius: '8px' }}>
          <strong>Total:</strong> {totalCount}
        </div>
        <div style={{ padding: '10px 20px', background: '#fff3e0', borderRadius: '8px' }}>
          <strong>To Watch:</strong> {counts['To Watch'] || 0}
        </div>
        <div style={{ padding: '10px 20px', background: '#e8f5e9', borderRadius: '8px' }}>
          <strong>Watching:</strong> {counts['Watching'] || 0}
        </div>
        <div style={{ padding: '10px 20px', background: '#f3e5f5', borderRadius: '8px' }}>
          <strong>Watched:</strong> {counts['Watched'] || 0}
        </div>
      </div>

      {/* Error Banner */}
      {errorMsg && (
        <div style={{ padding: '10px', background: '#ffebee', color: '#c62828', borderRadius: '4px', marginBottom: '15px' }}>
          ⚠️ {errorMsg}
        </div>
      )}

      {/* Add Movie Form */}
      <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '10px', marginBottom: '20px', background: '#f5f5f5', padding: '15px', borderRadius: '8px' }}>
        <h3>Add New Movie</h3>
        <input name="title" placeholder="Title" value={form.title} onChange={handleChange} required />
        <input name="genre" placeholder="Genre" value={form.genre} onChange={handleChange} required />
        <input name="releaseYear" type="number" placeholder="Release Year (1950 - Current)" value={form.releaseYear} onChange={handleChange} required />
        <input name="runtime" type="number" placeholder="Runtime in mins (30 - 300)" value={form.runtime} onChange={handleChange} required />
        <select name="status" value={form.status} onChange={handleChange}>
          <option value="To Watch">To Watch</option>
          <option value="Watching">Watching</option>
          <option value="Watched">Watched</option>
        </select>
        <button type="submit" style={{ padding: '10px', cursor: 'pointer', background: '#1976d2', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold' }}>
          Add Movie
        </button>
      </form>

      {/* Watch Next Feature */}
      <div style={{ marginBottom: '20px' }}>
        <button onClick={getWatchNext} style={{ padding: '8px 16px', cursor: 'pointer', background: '#388e3c', color: '#fff', border: 'none', borderRadius: '4px' }}>
          🎲 What should I watch next?
        </button>
        {recommended && <p style={{ marginTop: '10px', fontWeight: 'bold' }}>Recommendation: {recommended}</p>}
      </div>

      {/* Filter Buttons */}
      <div style={{ marginBottom: '15px' }}>
        <label style={{ marginRight: '10px' }}>Filter Status:</label>
        {['All', 'To Watch', 'Watching', 'Watched'].map(st => (
          <button 
            key={st} 
            onClick={() => setFilter(st)}
            style={{ marginRight: '5px', padding: '5px 10px', fontWeight: filter === st ? 'bold' : 'normal' }}
          >
            {st}
          </button>
        ))}
      </div>

      {/* Movie List */}
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {movies.map(movie => (
          <li key={movie._id} style={{ borderBottom: '1px solid #ccc', padding: '10px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <strong>{movie.title}</strong> ({movie.releaseYear}) - {movie.genre} | {movie.runtime} mins
              {movie.rating && <span> | ⭐ {movie.rating}/10</span>}
            </div>
            <div>
              <select 
                value={movie.status} 
                onChange={(e) => handleStatusChange(movie._id, e.target.value)}
                style={{ marginRight: '10px' }}
              >
                <option value="To Watch">To Watch</option>
                <option value="Watching">Watching</option>
                <option value="Watched">Watched</option>
              </select>
              <button onClick={() => handleDelete(movie._id)} style={{ background: '#d32f2f', color: '#fff', border: 'none', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer' }}>
                Delete
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default App;
