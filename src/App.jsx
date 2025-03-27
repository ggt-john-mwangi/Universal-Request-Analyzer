"use client"

import { useState, useEffect } from "react"
import "./App.css"

// Import pages
import PopupApp from "./pages/popup/PopupApp"
import OptionsApp from "./pages/options/OptionsApp"

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  )
}

function AppContent() {
  const location = useLocation()
  const [isOptionsPage, setIsOptionsPage] = useState(false)

  useEffect(() => {
    // Check if we're on the options page by looking at the URL query parameter
    const searchParams = new URLSearchParams(location.search)
    setIsOptionsPage(searchParams.get("page") === "options")
  }, [location])

  return (
    <div className="app-container">
      <Routes>
        <Route path="/" element={isOptionsPage ? <OptionsApp /> : <PopupApp />} />
      </Routes>
    </div>
  )
}

export default App

