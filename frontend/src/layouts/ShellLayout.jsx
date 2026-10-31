import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import BrightloopAIFloatingButton from '../components/ai/BrightloopAIFloatingButton.jsx'
import Sidebar from '../components/shared/Sidebar.jsx'
import TopHeader from '../components/shared/TopHeader.jsx'
import AIConversationProvider from '../context/AIConversationProvider.jsx'

export default function ShellLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)

  return (
    <AIConversationProvider>
      <div className="flex min-h-screen bg-canvas">
        <Sidebar open={sidebarOpen} collapsed={collapsed} onClose={() => setSidebarOpen(false)} />

        <div className="flex min-w-0 flex-1 flex-col">
          <TopHeader
            onMenuClick={() => setSidebarOpen(true)}
            collapsed={collapsed}
            onToggleCollapsed={() => setCollapsed((value) => !value)}
          />
          <main className="w-full min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
            <Outlet />
          </main>
        </div>

        <BrightloopAIFloatingButton />
      </div>
    </AIConversationProvider>
  )
}
