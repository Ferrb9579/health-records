import { NavLink, Outlet } from 'react-router-dom'

const navItems = [
  { to: '/', label: 'Dashboard' },
  { to: '/patients', label: 'Patients' },
  { to: '/visits', label: 'Visits' },
  { to: '/analytics', label: 'Analytics' },
  { to: '/preventive-care', label: 'Preventive Care' },
  { to: '/risk-panel', label: 'Risk Panel' },
  { to: '/system', label: 'System' },
]

export function Layout() {
  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <h1>Health Records Platform</h1>
          <p>Distributed frontend/backend replicas with PostgreSQL persistence and failover support.</p>
        </div>
      </header>

      <nav className="app-nav" aria-label="Primary navigation">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
          >
            {item.label}
          </NavLink>
        ))}
      </nav>

      <section className="app-content">
        <Outlet />
      </section>
    </main>
  )
}
