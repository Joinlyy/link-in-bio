import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import PublicPage from './pages/PublicPage'
import { FullScreenLoader } from './components/ui'
import { isCustomDomainHost } from './lib/config'

const Landing = lazy(() => import('./pages/Landing'))
const CustomDomainApp = lazy(() => import('./pages/CustomDomainApp'))

// Everything behind sign-in is code-split, so the public creator page
// ships without supabase-js, charts or the editor.
const AuthLayout = lazy(() => import('./context/AuthContext'))
const Guards = {
  RequireAuth: lazy(() => import('./context/AuthContext').then((m) => ({ default: m.RequireAuth }))),
  RequireAdmin: lazy(() => import('./context/AuthContext').then((m) => ({ default: m.RequireAdmin }))),
  GuestOnly: lazy(() => import('./context/AuthContext').then((m) => ({ default: m.GuestOnly }))),
}
const MediaKit = lazy(() => import('./pages/MediaKit'))
const ProductPage = lazy(() => import('./pages/ProductPage'))
const OrderPage = lazy(() => import('./pages/OrderPage'))
const Privacy = lazy(() => import('./pages/Legal').then((m) => ({ default: m.Privacy })))
const Terms = lazy(() => import('./pages/Legal').then((m) => ({ default: m.Terms })))
const SignIn = lazy(() => import('./pages/auth/SignIn'))
const SignUp = lazy(() => import('./pages/auth/SignUp'))
const ForgotPassword = lazy(() => import('./pages/auth/PasswordPages').then((m) => ({ default: m.ForgotPassword })))
const ResetPassword = lazy(() => import('./pages/auth/PasswordPages').then((m) => ({ default: m.ResetPassword })))
const AuthCallback = lazy(() => import('./pages/auth/PasswordPages').then((m) => ({ default: m.AuthCallback })))
const Onboarding = lazy(() => import('./pages/onboarding/Onboarding'))
const InstagramCallback = lazy(() => import('./pages/InstagramCallback'))
const DashboardLayout = lazy(() => import('./pages/dashboard/DashboardLayout'))
const Overview = lazy(() => import('./pages/dashboard/Overview'))
const Editor = lazy(() => import('./pages/dashboard/Editor'))
const Appearance = lazy(() => import('./pages/dashboard/Appearance'))
const Analytics = lazy(() => import('./pages/dashboard/Analytics'))
const Leads = lazy(() => import('./pages/dashboard/Leads'))
const MediaKitSettings = lazy(() => import('./pages/dashboard/MediaKitSettings'))
const Settings = lazy(() => import('./pages/dashboard/Settings'))
const Products = lazy(() => import('./pages/dashboard/products/Products'))
const ProductEditor = lazy(() => import('./pages/dashboard/products/ProductEditor'))
const Sales = lazy(() => import('./pages/dashboard/Sales'))
const BrandDeals = lazy(() => import('./pages/dashboard/BrandDeals'))
const Automations = lazy(() => import('./pages/dashboard/Automations'))
const Support = lazy(() => import('./pages/dashboard/Support'))
const AdminMessages = lazy(() => import('./pages/admin/AdminMessages'))
const AdminAudit = lazy(() => import('./pages/admin/AdminAudit'))
const AdminOrders = lazy(() => import('./pages/admin/AdminOrders'))
const AdminPlans = lazy(() => import('./pages/admin/AdminPlans'))
const AdminPayments = lazy(() => import('./pages/admin/AdminPayments'))
const AdminFraud = lazy(() => import('./pages/admin/AdminFraud'))
const AdminDisputes = lazy(() => import('./pages/admin/AdminDisputes'))
const Invoices = lazy(() => import('./pages/dashboard/Invoices'))
const InvoicePrint = lazy(() => import('./pages/dashboard/InvoicePrint'))
const Audience = lazy(() => import('./pages/dashboard/Audience'))
const Referrals = lazy(() => import('./pages/dashboard/Referrals'))
const Billing = lazy(() => import('./pages/dashboard/Billing'))
const Team = lazy(() => import('./pages/dashboard/Team'))
const Templates = lazy(() => import('./pages/dashboard/Templates'))
const Guide = lazy(() => import('./pages/dashboard/Guide'))
const ContentForms = lazy(() => import('./pages/dashboard/ContentForms'))
const BrandForm = lazy(() => import('./pages/dashboard/BrandForm'))
const Academy = lazy(() => import('./pages/Academy'))
const AdminLayout = lazy(() => import('./pages/admin/AdminLayout'))
const AdminOverview = lazy(() => import('./pages/admin/AdminOverview'))
const AdminCreators = lazy(() => import('./pages/admin/AdminCreators'))
const AdminReports = lazy(() => import('./pages/admin/AdminReports'))
const AdminDomains = lazy(() => import('./pages/admin/AdminDomains'))

const { RequireAuth, RequireAdmin, GuestOnly } = Guards

export default function App() {
  if (isCustomDomainHost()) {
    return (
      <BrowserRouter>
        <Suspense fallback={<FullScreenLoader />}>
          <CustomDomainApp />
        </Suspense>
      </BrowserRouter>
    )
  }
  return (
    <BrowserRouter>
      <Suspense fallback={<FullScreenLoader />}>
        <Routes>
          {/* Public, no auth bootstrapping */}
          <Route path="/" element={<Landing />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/academy" element={<Academy />} />
          <Route path="/academy/:slug" element={<Academy />} />
          <Route path="/:username" element={<PublicPage />} />
          <Route path="/:username/media-kit" element={<MediaKit />} />
          <Route path="/:username/p/:productId" element={<ProductPage />} />
          <Route path="/:username/:slug" element={<PublicPage />} />
          <Route path="/order/:token" element={<OrderPage />} />

          {/* App (Supabase auth loaded lazily) */}
          <Route element={<AuthLayout />}>
            <Route path="/signin" element={<GuestOnly><SignIn /></GuestOnly>} />
            <Route path="/signup" element={<GuestOnly><SignUp /></GuestOnly>} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route path="/onboarding" element={<RequireAuth><Onboarding /></RequireAuth>} />
            <Route path="/instagram/callback" element={<RequireAuth><InstagramCallback /></RequireAuth>} />
            <Route path="/invoices/:id/print" element={<RequireAuth><InvoicePrint /></RequireAuth>} />

            <Route path="/dashboard" element={<RequireAuth><DashboardLayout /></RequireAuth>}>
              <Route index element={<Overview />} />
              <Route path="editor" element={<Editor />} />
              <Route path="appearance" element={<Appearance />} />
              <Route path="analytics" element={<Analytics />} />
              <Route path="leads" element={<Leads />} />
              <Route path="media-kit" element={<MediaKitSettings />} />
              <Route path="settings" element={<Settings />} />
              <Route path="products" element={<Products />} />
              <Route path="products/:id" element={<ProductEditor />} />
              <Route path="sales" element={<Sales />} />
              <Route path="deals" element={<BrandDeals />} />
              <Route path="automations" element={<Automations />} />
              <Route path="messages" element={<Support />} />
              <Route path="invoices" element={<Invoices />} />
              <Route path="audience" element={<Audience />} />
              <Route path="referrals" element={<Referrals />} />
              <Route path="billing" element={<Billing />} />
              <Route path="team" element={<Team />} />
              <Route path="templates" element={<Templates />} />
              <Route path="content" element={<ContentForms />} />
              <Route path="guide" element={<Guide />} />
              <Route path="brand-form" element={<BrandForm />} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Route>

            <Route path="/admin" element={<RequireAuth><RequireAdmin><AdminLayout /></RequireAdmin></RequireAuth>}>
              <Route index element={<AdminOverview />} />
              <Route path="creators" element={<AdminCreators />} />
              <Route path="reports" element={<AdminReports />} />
              <Route path="domains" element={<AdminDomains />} />
              <Route path="messages" element={<AdminMessages />} />
              <Route path="orders" element={<AdminOrders />} />
              <Route path="audit" element={<AdminAudit />} />
              <Route path="plans" element={<AdminPlans />} />
              <Route path="payments" element={<AdminPayments />} />
              <Route path="fraud" element={<AdminFraud />} />
              <Route path="disputes" element={<AdminDisputes />} />
              <Route path="*" element={<Navigate to="/admin" replace />} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
