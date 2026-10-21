import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { NuevaParcela } from './pages/NuevaParcela';
import { DetalleParcela } from './pages/DetalleParcela';
import './App.css';

function Home() {
  return (
    <div style={{ padding: '2rem', maxWidth: '960px', margin: '0 auto' }}>
      <h1>ProyectoDACS</h1>
      <p>Sistema de apoyo a pequeños agricultores.</p>
      <nav style={{ marginTop: '1rem' }}>
        <Link to="/parcelas/nueva">Nueva parcela</Link>
      </nav>
    </div>
  );
}

function NotFound() {
  return (
    <div style={{ padding: '2rem' }}>
      <h1>404</h1>
      <Link to="/">Volver al inicio</Link>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/parcelas/nueva" element={<NuevaParcela />} />
        <Route path="/parcelas/:id" element={<DetalleParcela />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
