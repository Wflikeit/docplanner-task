import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { ListingDetailsPage } from './listings/routes/ListingDetailsPage'
import { ListingsPage } from './listings/routes/ListingsPage'

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-svh bg-gray-100 text-gray-900 dark:bg-gray-950 dark:text-gray-100">
        <Routes>
          <Route path="/" element={<ListingsPage />} />
          <Route path="/listings/:id" element={<ListingDetailsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </BrowserRouter>
  )
}
