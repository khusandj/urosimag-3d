import { Box, Layers } from 'lucide-react'
import useStore from '../store'

export default function Header() {
  const showDieline = useStore(s => s.showDieline)
  const toggleDieline = useStore(s => s.toggleDieline)

  return (
    <header style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '8px 16px',
      background: 'var(--bg-panel)',
      borderBottom: '1px solid var(--border)',
      flexShrink: 0,
      gap: 12,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Box size={18} color="var(--accent)" strokeWidth={2} />
        <div>
          <h1 style={{ fontSize: 13, color: 'var(--text-primary)', letterSpacing: 1.5, fontWeight: 700 }}>
            3D BOX VIEW
          </h1>
        </div>
      </div>

      <div style={{
        display: 'flex',
        background: 'var(--bg-elevated)',
        borderRadius: 'var(--radius)',
        padding: 2,
        border: '1px solid var(--border)',
      }}>
        <TabBtn active={showDieline} onClick={toggleDieline} icon={<Layers size={13} />}>
          Dieline
        </TabBtn>
        <TabBtn active={!showDieline} onClick={toggleDieline} icon={<Box size={13} />}>
          Faqat 3D
        </TabBtn>
      </div>
    </header>
  )
}

function TabBtn({ children, active, onClick, icon }) {
  return (
    <button onClick={onClick} style={{
      padding: '5px 14px',
      borderRadius: 6,
      border: 'none',
      background: active ? 'var(--accent-solid)' : 'transparent',
      color: active ? '#fff' : 'var(--text-tertiary)',
      fontSize: 11,
      cursor: 'pointer',
      fontWeight: active ? 600 : 400,
      transition: 'all .15s ease',
      display: 'flex',
      alignItems: 'center',
      gap: 5,
    }}>
      {icon}{children}
    </button>
  )
}
