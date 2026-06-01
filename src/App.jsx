import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import { Navigate } from 'react-router-dom';
import ProtectedRoute from '@/components/ProtectedRoute';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Layout from './components/Layout';
import Home from './pages/Home';
import AdminDashboard from './pages/AdminDashboard';
import ClientManagement from './pages/ClientManagement';
import ScriptList from './pages/ScriptList';
import ScriptBuilder from './pages/ScriptBuilder';
import TTSBuilder from './pages/TTSBuilder';
import VirtualNumbers from './pages/VirtualNumbers';
import ClientDashboard from './pages/ClientDashboard';
import Campaigns from './pages/Campaigns';
import CampaignDetail from './pages/CampaignDetail';
import CallResults from './pages/CallResults';
import Analytics from './pages/Analytics';
import VapiEvents from './pages/VapiEvents';
import AdminRoute from './components/AdminRoute';
import Profitability from './pages/admin/Profitability';
import QuickDial from './pages/admin/QuickDial';
import AllCampaigns from './pages/admin/AllCampaigns';
import SystemSettings from './pages/admin/SystemSettings';
import RelevantContacts from './pages/RelevantContacts';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Handle authentication errors
  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      // Redirect to login automatically
      navigateToLogin();
      return null;
    }
  }

  // Render the main app
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />} />}>
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/dashboard" element={<ClientDashboard />} />
          <Route path="/campaigns" element={<Campaigns />} />
          <Route path="/campaigns/:campaignId" element={<CampaignDetail />} />
          <Route path="/results" element={<RelevantContacts />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route element={<AdminRoute />}>
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/clients" element={<ClientManagement />} />
            <Route path="/admin/campaigns" element={<AllCampaigns />} />
            <Route path="/admin/scripts" element={<ScriptList />} />
            <Route path="/admin/scripts/:scriptId" element={<ScriptBuilder />} />
            <Route path="/admin/tts" element={<TTSBuilder />} />
            <Route path="/admin/numbers" element={<VirtualNumbers />} />
            <Route path="/admin/profitability" element={<Profitability />} />
            <Route path="/admin/vapi-events" element={<VapiEvents />} />
            <Route path="/admin/settings" element={<SystemSettings />} />
            <Route path="/admin/quick-dial" element={<QuickDial />} />
          </Route>
        </Route>
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};


function App() {

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>

          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App