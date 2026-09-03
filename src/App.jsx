import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import ProtectedLayout from './components/navegacao/ProtectedLayout'
import Login from './pages/Login'
import Register from './pages/Register'
import Home from './pages/Home'
import Hierarchy from './pages/Hierarchy'
import Prices from './pages/Prices'
import RegisterSale from './pages/RegisterSale'
import SalesHistory from './pages/SalesHistory'
import Farm from './pages/Farm'
import FarmHistory from './pages/FarmHistory'
import Notices from './pages/Notices'
import Profile from './pages/Profile'
import PendingAccess from './pages/PendingAccess'

export default function App() {
  const { user, loading } = useAuth()

  if (loading) {
    return <div className="screen-center"><div className="spinner" /></div>
  }

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" /> : <Login />} />
      <Route path="/cadastro" element={user ? <Navigate to="/" /> : <Register />} />

      <Route element={user ? <ProtectedLayout /> : <Navigate to="/login" />}>
        <Route path="/aguardando" element={<PendingAccess />} />
        <Route path="/" element={<Home />} />
        <Route path="/hierarquia" element={<Hierarchy />} />
        <Route path="/tabela-de-precos" element={<Prices />} />
        <Route path="/registradora" element={<RegisterSale />} />
        <Route path="/historico-vendas" element={<SalesHistory />} />
        <Route path="/farm" element={<Farm />} />
        <Route path="/historico-farm" element={<FarmHistory />} />
        <Route path="/avisos" element={<Notices />} />
        <Route path="/perfil" element={<Profile />} />
      </Route>

      <Route path="*" element={<Navigate to={user ? "/" : "/login"} />} />
    </Routes>
  )
}
