import { createBrowserRouter, Navigate } from 'react-router'
import Layout from './components/Layout.tsx'
import LoginPage from './pages/LoginPage.tsx'
import WeekPage from './pages/WeekPage.tsx'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <Navigate to="/week" replace /> },
      { path: 'login', element: <LoginPage /> },
      { path: 'week', element: <WeekPage /> },
      { path: '*', element: <Navigate to="/week" replace /> },
    ],
  },
])
