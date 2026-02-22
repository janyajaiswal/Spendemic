import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Landing from './pages/Landing';
import Placeholder from './pages/Placeholder';
import './App.css';

function App() {
  return (
    <BrowserRouter>
      <div className="app-container">
        <Sidebar />
        <div className="main-content">
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/dashboard" element={<Placeholder title="Dashboard" />} />
            <Route path="/budgets" element={<Placeholder title="Budgets" />} />
            <Route path="/expenses" element={<Placeholder title="Expenses" />} />
            <Route path="/reports" element={<Placeholder title="Reports" />} />
            <Route path="/settings" element={<Placeholder title="Settings" />} />
          </Routes>
        </div>
      </div>
    </BrowserRouter>
  );
}

export default App;
