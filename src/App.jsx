import { Routes, Route } from 'react-router-dom'
import Landing from './pages/Landing.jsx'
import Signup from './pages/Signup.jsx'
import Login from './pages/Login.jsx'
import VerifyEmail from './pages/VerifyEmail.jsx'
import ForgotPassword from './pages/ForgotPassword.jsx'
import ResetPassword from './pages/ResetPassword.jsx'
import DashboardLayout from './dashboard/DashboardLayout.jsx'
import Overview from './dashboard/Overview.jsx'
import Alerts from './dashboard/Alerts.jsx'
import Library from './dashboard/Library.jsx'
import Playbooks from './dashboard/Playbooks.jsx'
import AdminOverview from './dashboard/AdminOverview.jsx'
import AdminInstitutions from './dashboard/AdminInstitutions.jsx'
import AdminInstitution from './dashboard/AdminInstitution.jsx'
import AdminAlerts from './dashboard/AdminAlerts.jsx'
import AdminAlertNew from './dashboard/AdminAlertNew.jsx'
import AdminAlertDetail from './dashboard/AdminAlertDetail.jsx'
import Team from './dashboard/Team.jsx'
import Guard, { AdminGuard } from './dashboard/Guard.jsx'
import AcceptInvite from './pages/AcceptInvite.jsx'
import Placeholder from './dashboard/Placeholder.jsx'
import Reports from './dashboard/Reports.jsx'
import RiskScore from './dashboard/RiskScore.jsx'
import Community from './dashboard/Community.jsx'
import AdminLibrary from './dashboard/AdminLibrary.jsx'
import AdminPosts from './dashboard/AdminPosts.jsx'
import AdminCommunity from './dashboard/AdminCommunity.jsx'
import Security from "./dashboard/Security.jsx"
import AdminUsers from "./dashboard/AdminUsers.jsx"

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/login" element={<Login />} />
      <Route path="/accept-invite" element={<AcceptInvite />} />
      <Route path="/verify-email" element={<VerifyEmail />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/dashboard" element={<DashboardLayout />}>
        <Route index element={<Overview />} />
        <Route
          path="alerts"
          element={
            <Guard perm="alerts:view">
              <Alerts />
            </Guard>
          }
        />
        <Route path="library" element={<Library />} />
        <Route
          path="team"
          element={
            <Guard perm="team:manage">
              <Team />
            </Guard>
          }
        />
        <Route
          path="admin"
          element={
            <AdminGuard>
              <AdminOverview />
            </AdminGuard>
          }
        />
        <Route
          path="admin/institutions"
          element={
            <AdminGuard>
              <AdminInstitutions />
            </AdminGuard>
          }
        />
        <Route
          path="admin/institutions/:id"
          element={
            <AdminGuard>
              <AdminInstitution />
            </AdminGuard>
          }
        />
        <Route
          path="admin/alerts"
          element={
            <AdminGuard>
              <AdminAlerts />
            </AdminGuard>
          }
        />
        <Route
          path="admin/library"
          element={
            <AdminGuard>
              <AdminLibrary />
            </AdminGuard>
          }
        />
        <Route
          path="admin/reviews"
          element={
            <AdminGuard>
              <AdminPosts kind="review" />
            </AdminGuard>
          }
        />
        <Route
          path="admin/community"
          element={
            <AdminGuard>
              <AdminCommunity />
            </AdminGuard>
          }
        />
        <Route
          path="admin/alerts/new"
          element={
            <AdminGuard>
              <AdminAlertNew />
            </AdminGuard>
          }
        />
        <Route
          path="admin/alerts/:id"
          element={
            <AdminGuard>
              <AdminAlertDetail />
            </AdminGuard>
          }
        />
        <Route
          path="admin/users"
          element={
            <AdminGuard>
              <AdminUsers />
            </AdminGuard>
          }
        />
        <Route path="security" element={<Security />} />
        <Route path="playbooks" element={<Playbooks />} />
        <Route path="reports" element={<Reports />} />
        <Route path="risk" element={<RiskScore />} />
        <Route
          path="departments"
          element={
            <Placeholder
              title="Department intelligence"
              intro="See which parts of your institution carry the most risk."
              status="Not available yet."
              points={[
                "Group your team into departments",
                "See which departments respond to alerts, and how quickly",
                "This needs a decision on how departments are defined for your institutions",
              ]}
            />
          }
        />
        <Route path="community" element=<Community /> />
      </Route>
    </Routes>
  );
}
