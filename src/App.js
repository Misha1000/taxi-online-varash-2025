// src/App.js

import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';

// Головна (стисла) сторінка
import Home from './pages/Home';

// НОВЕ: сторінка пасажира
import PassengerDashboard from './pages/PassengerDashboard';

function App() {
  return (
    <Router>
      <nav style={{ padding: 10, borderBottom: '1px solid #eee' }}>
        <Link to="/" style={{ marginRight: 10 }}>Головна</Link>
        <Link to="/passenger">Кабінет пасажира</Link>
      </nav>

      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/passenger" element={<PassengerDashboard />} />
      </Routes>
    </Router>
  );
}

export default App;
