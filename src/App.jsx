import { useRef, useCallback } from 'react'
import useStore from './store'
import Header from './components/Header'
import DielineEditor from './components/DielineEditor'
import BoxScene from './components/BoxScene'
import RightPanel from './components/RightPanel'
import StatusBar from './components/StatusBar'

export default function App() {
  const showDieline = useStore(s => s.showDieline)
  const flashMsg    = useStore(s => s.flashMsg)

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100vh', overflow:'hidden' }}>
      <Header />

      <div style={{ display:'flex', flex:1, overflow:'hidden' }}>
        {showDieline && <DielineEditor />}
        <BoxScene flashMsg={flashMsg} />
        <RightPanel />
      </div>

      <StatusBar />
    </div>
  )
}
