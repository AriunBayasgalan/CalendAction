import { createBrowserRouter, Navigate } from 'react-router'
import Layout from './components/Layout.tsx'
import RequireAuth from './components/RequireAuth.tsx'
import RuleForm from './components/RuleForm.tsx'
import HomePage from './pages/HomePage.tsx'
import LoginPage from './pages/LoginPage.tsx'
import RegisterPage from './pages/RegisterPage.tsx'
import WeekPage from './pages/WeekPage.tsx'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'login', element: <LoginPage /> },
      { path: 'register', element: <RegisterPage /> },
      {
        path: 'week',
        element: (
          <RequireAuth>
            <WeekPage />
          </RequireAuth>
        ),
      },
      {
        path: 'rules',
        element: (
          <RequireAuth>
            <RuleForm />
          </RequireAuth>
        ),
      },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
])
