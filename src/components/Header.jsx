import useStore from '../store'

export default function Header() {
  const showDieline = useStore(s => s.showDieline)
  const toggleDieline = useStore(s => s.toggleDieline)

  return (
    <header style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '7px 16px',
      background: 'linear-gradient(90deg,#12100a,#1c1500,#12100a)',
      borderBottom: '1px solid #4a3000',
      flexShrink: 0,
    }}>
      <div>
        <h1 style={{ fontSize: 14, color: '#d4a030', letterSpacing: 2, fontWeight: 700 }}>
          UROSIMAG 3D BOX VIEWER
        </h1>
        <p style={{ fontSize: 10, color: '#806030', marginTop: 2 }}>
          Dieline → Avtomatik 3D Karobka · 2K / 4K Export
        </p>
      </div>

      <div style={{ display: 'flex', gap: 6 }}>
        <TabBtn active={showDieline}  onClick={toggleDieline}>Dieline Editor</TabBtn>
        <TabBtn active={!showDieline} onClick={toggleDieline}>Faqat 3D</TabBtn>
      </div>
    </header>
  )
}

function TabBtn({ children, active, onClick }) {
  return (
    <button onClick={onClick} style={{
      padding: '5px 13px',
      borderRadius: 5,
      border: '1px solid #5a3800',
      background: active ? 'rgba(200,150,20,.3)' : 'rgba(200,150,20,.08)',
      color: active ? '#e8c050' : '#b09040',
      fontSize: 11,
      cursor: 'pointer',
      fontWeight: active ? 600 : 400,
      transition: 'all .15s',
    }}>
      {children}
    </button>
  )
}
