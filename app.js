const { useEffect, useMemo, useState } = React

const cfg = window.JIRA_CONFIG || {}
if (!cfg.supabaseUrl || !cfg.supabasePublishableKey) {
  throw new Error('Falta la configuración pública de Supabase en config.js')
}

const db = window.supabase.createClient(cfg.supabaseUrl, cfg.supabasePublishableKey)

const getAppUrl = () => {
  const configured = String(cfg.appUrl || '').trim()
  if (configured) return configured.endsWith('/') ? configured : configured + '/'
  const path = window.location.pathname.endsWith('/')
    ? window.location.pathname
    : window.location.pathname.replace(/[^/]*$/, '')
  return `${window.location.origin}${path || '/'}`
}

const cleanupAuthUrl = () => {
  const authHash = /(?:access_token|refresh_token|error|error_description)=/.test(window.location.hash)
  const authQuery = /(?:code|token_hash|type)=/.test(window.location.search)
  if (authHash || authQuery) window.history.replaceState({}, document.title, getAppUrl())
}

const STATUS = [
  ['backlog', 'Backlog', 'lucide:circle-dashed'],
  ['todo', 'Por hacer', 'lucide:circle'],
  ['in_progress', 'En curso', 'lucide:loader-circle'],
  ['dev_done', 'Dev terminado', 'lucide:code-2'],
  ['qa_review', 'Revisión QA', 'lucide:scan-search'],
  ['qa_rejected', 'QA rechazado', 'lucide:circle-x'],
  ['qa_passed', 'QA aprobado', 'lucide:circle-check-big'],
  ['closed', 'Cerrado', 'lucide:badge-check']
]

const PRIORITIES = ['lowest', 'low', 'medium', 'high', 'highest', 'blocker']
const TYPES = ['task', 'bug', 'story', 'improvement']

const PRIORITY_LABELS = {
  lowest: 'Muy baja', low: 'Baja', medium: 'Media', high: 'Alta', highest: 'Muy alta', blocker: 'Bloqueante'
}
const TYPE_LABELS = { task: 'Tarea', bug: 'Bug', story: 'Historia', improvement: 'Mejora' }

const Icon = ({ name, size = 18 }) => <iconify-icon icon={name} width={size} height={size}></iconify-icon>
const statusLabel = value => STATUS.find(x => x[0] === value)?.[1] || value
const statusIcon = value => STATUS.find(x => x[0] === value)?.[2] || 'lucide:circle'
const formatDate = value => value ? new Intl.DateTimeFormat('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(`${value}T12:00:00`)) : '—'
const initials = value => String(value || '?').split(/\s+/).slice(0, 2).map(x => x[0]).join('').toUpperCase()

function useSession() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    db.auth.getSession().then(({ data }) => {
      setSession(data.session)
      if (data.session) cleanupAuthUrl()
      setLoading(false)
    })
    const { data: { subscription } } = db.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession)
      if (nextSession && ['SIGNED_IN', 'TOKEN_REFRESHED', 'USER_UPDATED'].includes(event)) cleanupAuthUrl()
    })
    return () => subscription.unsubscribe()
  }, [])

  return { session, loading }
}

function Auth() {
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [msg, setMsg] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    setMsg('')
    const result = mode === 'login'
      ? await db.auth.signInWithPassword({ email, password })
      : await db.auth.signUp({
          email,
          password,
          options: { data: { full_name: name }, emailRedirectTo: getAppUrl() }
        })
    setMsg(result.error
      ? result.error.message
      : mode === 'login'
        ? 'Acceso correcto.'
        : 'Cuenta creada. Revisa tu correo para confirmar el acceso.')
    setSubmitting(false)
  }

  return <div className="auth-shell">
    <div className="auth-card">
      <div className="auth-logo-wrap"><img src="./logo.svg" className="auth-logo" alt="TROBBU" /></div>
      <div className="auth-title"><span>Jira Interno</span><strong>TROBBU Technology</strong></div>
      <p className="auth-subtitle">Gestión centralizada de tickets, sprints, Desarrollo y QA.</p>
      <form onSubmit={submit}>
        {mode === 'signup' && <label>Nombre completo<input value={name} onChange={e => setName(e.target.value)} required placeholder="Nombre del colaborador" /></label>}
        <label>Correo<input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="correo@trobbu.com" /></label>
        <label>Contraseña<input type="password" minLength="6" value={password} onChange={e => setPassword(e.target.value)} required placeholder="••••••••" /></label>
        <button className="primary auth-submit" type="submit" disabled={submitting}>{submitting ? 'Procesando…' : mode === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}</button>
      </form>
      <button className="link" onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setMsg('') }}>
        {mode === 'login' ? 'Crear una cuenta nueva' : 'Ya tengo una cuenta'}
      </button>
      {msg && <div className="notice">{msg}</div>}
    </div>
  </div>
}

function App() {
  const { session, loading } = useSession()
  if (loading) return <div className="center loading-screen"><span className="loader"></span><span>Cargando Jira Interno…</span></div>
  if (!session) return <Auth />
  return <WorkspaceApp session={session} />
}

function WorkspaceApp({ session }) {
  const [memberships, setMemberships] = useState([])
  const [workspace, setWorkspace] = useState(null)
  const [products, setProducts] = useState([])
  const [productId, setProductId] = useState('all')
  const [sprints, setSprints] = useState([])
  const [sprintId, setSprintId] = useState('all')
  const [tickets, setTickets] = useState([])
  const [members, setMembers] = useState([])
  const [view, setView] = useState('board')
  const [boardMode, setBoardMode] = useState('table')
  const [statusFilter, setStatusFilter] = useState('all')
  const [assigneeFilter, setAssigneeFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState('')
  const [ticketModal, setTicketModal] = useState(false)
  const [sprintModal, setSprintModal] = useState(false)
  const [inviteModal, setInviteModal] = useState(false)

  const loadMemberships = async () => {
    const { data, error } = await db.from('workspace_members').select('workspace_id,role,workspaces(id,name,slug)').eq('active', true)
    if (error) { setError(error.message); setBusy(false); return }
    setMemberships(data || [])
    if (!workspace && data?.length) setWorkspace(data[0].workspaces)
    setBusy(false)
  }

  useEffect(() => { loadMemberships() }, [])

  const loadAll = async () => {
    if (!workspace) return
    setBusy(true)
    setError('')
    const [p, s, t, m] = await Promise.all([
      db.from('products').select('*').eq('workspace_id', workspace.id).order('board_order'),
      db.from('sprints').select('*').eq('workspace_id', workspace.id).order('created_at', { ascending: false }),
      db.from('tickets').select('*').eq('workspace_id', workspace.id).order('updated_at', { ascending: false }),
      db.from('workspace_members').select('user_id,role,active').eq('workspace_id', workspace.id).eq('active', true)
    ])
    const firstErr = [p, s, t, m].find(x => x.error)?.error
    if (firstErr) { setError(firstErr.message); setBusy(false); return }

    setProducts(p.data || [])
    setSprints(s.data || [])
    setTickets(t.data || [])

    const ids = (m.data || []).map(x => x.user_id)
    const profileMap = {}
    if (ids.length) {
      const pr = await db.from('profiles').select('*').in('id', ids)
      ;(pr.data || []).forEach(x => profileMap[x.id] = x)
    }
    setMembers((m.data || []).map(x => ({ ...x, profile: profileMap[x.user_id] })))
    setBusy(false)
  }

  useEffect(() => { loadAll() }, [workspace?.id])

  const scopedTickets = useMemo(() => tickets.filter(t =>
    (productId === 'all' || t.product_id === productId) &&
    (sprintId === 'all' || t.sprint_id === sprintId)
  ), [tickets, productId, sprintId])

  const boardTickets = useMemo(() => scopedTickets.filter(t => {
    const matchStatus = statusFilter === 'all' || t.status === statusFilter
    const matchAssignee = assigneeFilter === 'all' || t.dev_owner_id === assigneeFilter || t.qa_owner_id === assigneeFilter
    const q = search.trim().toLowerCase()
    const matchSearch = !q || `${t.ticket_key || ''} ${t.title || ''} ${t.description || ''}`.toLowerCase().includes(q)
    return matchStatus && matchAssignee && matchSearch
  }), [scopedTickets, statusFilter, assigneeFilter, search])

  const myTickets = useMemo(() => scopedTickets.filter(t =>
    t.dev_owner_id === session.user.id || t.qa_owner_id === session.user.id || t.reporter_id === session.user.id
  ), [scopedTickets, session.user.id])

  const stats = useMemo(() => ({
    created: scopedTickets.length,
    inProgress: scopedTickets.filter(t => t.status === 'in_progress').length,
    devDone: scopedTickets.filter(t => t.dev_completed_at).length,
    qaDone: scopedTickets.filter(t => t.qa_completed_at).length,
    rejected: scopedTickets.filter(t => t.status === 'qa_rejected').length,
    closed: scopedTickets.filter(t => t.status === 'closed').length,
  }), [scopedTickets])

  const createWorkspace = async () => {
    const name = prompt('Nombre del workspace', 'Trobbu Tecnología')
    if (!name) return
    const slug = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') + '-' + Math.random().toString(36).slice(2, 6)
    const { data, error } = await db.from('workspaces').insert({ name, slug, created_by: session.user.id }).select().single()
    if (error) return setError(error.message)
    setWorkspace(data)
    await loadMemberships()
  }

  if (!workspace && !busy) return <div className="empty-state"><img src="./logo.svg" className="empty-logo" alt="TROBBU" /><h2>Configura tu espacio de trabajo</h2><p>Se crearán automáticamente Web Administrativa, Web Socios y App Socios.</p><button className="primary" onClick={createWorkspace}><Icon name="lucide:plus" /> Crear workspace</button></div>

  const myRole = memberships.find(m => m.workspace_id === workspace?.id)?.role || 'viewer'
  const canManage = ['admin', 'pm'].includes(myRole)
  const currentMember = members.find(m => m.user_id === session.user.id)
  const currentName = currentMember?.profile?.full_name || session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'Usuario'

  const runNotifications = async () => { try { await db.functions.invoke('process-notifications', { body: { workspace_id: workspace.id } }) } catch {} }
  const moveTicket = async (ticket, status) => {
    const { error } = await db.from('tickets').update({ status }).eq('id', ticket.id)
    if (error) setError(error.message)
    else { await loadAll(); runNotifications() }
  }

  const pageMeta = {
    dashboard: ['Dashboard', 'Indicadores del sprint y avance general del equipo.'],
    tasks: ['Mis tareas', 'Tickets en los que participas como reporter, Dev o QA.'],
    board: ['Mis Tickets', 'Consulta, filtra y gestiona todos los tickets del equipo.'],
    team: ['Miembros', 'Colaboradores, roles y accesos del workspace.']
  }[view]

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="sidebar-brand">
        <img src="./logo.svg" alt="TROBBU" className="sidebar-logo" />
        <div><strong>TROBBU</strong><span>Jira Interno</span></div>
      </div>

      <div className="sidebar-separator"></div>
      <div className="sidebar-title-row"><span>WORKSPACES</span><button title="Nuevo workspace" onClick={canManage ? createWorkspace : undefined}><Icon name="lucide:plus-circle" size={17} /></button></div>
      <button className="workspace-card">
        <span className="workspace-avatar"><Icon name="lucide:panels-top-left" size={20} /></span>
        <span className="workspace-copy"><b>{workspace?.name || 'Workspace'}</b><small>{myRole.toUpperCase()}</small></span>
        <Icon name="lucide:chevrons-up-down" size={15} />
      </button>

      <nav className="sidebar-nav">
        <button className={view === 'dashboard' ? 'active' : ''} onClick={() => setView('dashboard')}><Icon name="lucide:house" /><span>Inicio</span></button>
        <button className={view === 'tasks' ? 'active' : ''} onClick={() => setView('tasks')}><Icon name="lucide:circle-check-big" /><span>Mis tareas</span><em>{myTickets.length}</em></button>
        <button className={view === 'board' ? 'active' : ''} onClick={() => setView('board')}><Icon name="lucide:columns-3" /><span>Tablero</span></button>
        <button className={view === 'team' ? 'active' : ''} onClick={() => setView('team')}><Icon name="lucide:users" /><span>Miembros</span></button>
      </nav>

      <div className="sidebar-separator"></div>
      <div className="sidebar-title-row"><span>PRODUCTOS</span><button title="Productos"><Icon name="lucide:folder-plus" size={17} /></button></div>
      <div className="product-list">
        <button className={productId === 'all' ? 'product active' : 'product'} onClick={() => setProductId('all')}><span className="product-icon product-all"><Icon name="lucide:boxes" size={16} /></span><span>Todos los productos</span></button>
        {products.map((p, index) => <button key={p.id} className={productId === p.id ? 'product active' : 'product'} onClick={() => { setProductId(p.id); setView('board') }}>
          <span className={`product-icon product-${index % 3}`}><Icon name={index % 3 === 2 ? 'lucide:smartphone' : index % 3 === 1 ? 'lucide:users-round' : 'lucide:monitor-cog'} size={16} /></span>
          <span>{p.name}</span>
        </button>)}
      </div>

      <div className="sidebar-user">
        <div className="user-avatar">{initials(currentName)}</div>
        <div className="user-copy"><b>{currentName}</b><span>{session.user.email}</span></div>
        <button className="icon-button" title="Cerrar sesión" onClick={() => db.auth.signOut()}><Icon name="lucide:log-out" size={18} /></button>
      </div>
    </aside>

    <main className="main-area">
      <header className="topbar">
        <div className="page-heading">
          <div className="breadcrumb"><span>{workspace?.name}</span><Icon name="lucide:chevron-right" size={14} /><span>{productId === 'all' ? 'Todos los productos' : products.find(p => p.id === productId)?.name}</span></div>
          <h1>{pageMeta[0]}</h1>
          <p>{pageMeta[1]}</p>
        </div>
        <div className="top-user-actions">
          <button className="icon-button top-icon" title="Notificaciones"><Icon name="lucide:bell" /></button>
          <button className="icon-button top-icon" title="Ayuda"><Icon name="lucide:circle-help" /></button>
          <div className="top-profile"><div className="user-avatar">{initials(currentName)}</div><div><b>{currentName}</b><span>{myRole.toUpperCase()}</span></div><Icon name="lucide:chevron-down" size={16} /></div>
        </div>
      </header>

      {error && <div className="error global-error"><Icon name="lucide:triangle-alert" /> {error}</div>}

      {busy ? <div className="center content-loader"><span className="loader"></span><span>Actualizando información…</span></div> : <>
        {view === 'dashboard' && <Dashboard stats={stats} tickets={scopedTickets} products={products} members={members} sprints={sprints} sprintId={sprintId} setSprintId={setSprintId} canManage={canManage} openTicket={() => setTicketModal(true)} openSprint={() => setSprintModal(true)} />}
        {view === 'tasks' && <TasksView tickets={myTickets} products={products} members={members} sprints={sprints} sprintId={sprintId} setSprintId={setSprintId} openTicket={() => setTicketModal(true)} />}
        {view === 'board' && <BoardWorkspace tickets={boardTickets} products={products} members={members} moveTicket={moveTicket} boardMode={boardMode} setBoardMode={setBoardMode} sprints={sprints} sprintId={sprintId} setSprintId={setSprintId} statusFilter={statusFilter} setStatusFilter={setStatusFilter} assigneeFilter={assigneeFilter} setAssigneeFilter={setAssigneeFilter} search={search} setSearch={setSearch} openTicket={() => setTicketModal(true)} />}
        {view === 'team' && <Team members={members} canManage={canManage} openInvite={() => setInviteModal(true)} />}
      </>}
    </main>

    {ticketModal && <TicketModal workspace={workspace} products={products} sprints={sprints} members={members} user={session.user} onClose={() => setTicketModal(false)} onSaved={async () => { setTicketModal(false); await loadAll(); runNotifications() }} />}
    {sprintModal && <SprintModal workspace={workspace} user={session.user} onClose={() => setSprintModal(false)} onSaved={async () => { setSprintModal(false); await loadAll() }} />}
    {inviteModal && <InviteModal workspace={workspace} onClose={() => setInviteModal(false)} onSaved={async () => { setInviteModal(false); await loadAll() }} />}
  </div>
}

function Dashboard({ stats, tickets, products, members, sprints, sprintId, setSprintId, canManage, openTicket, openSprint }) {
  const cards = [
    ['Tickets creados', stats.created, 'lucide:ticket', 'neutral'],
    ['En curso', stats.inProgress, 'lucide:loader-circle', 'warning'],
    ['Finalizados Dev', stats.devDone, 'lucide:code-2', 'blue'],
    ['Finalizados QA', stats.qaDone, 'lucide:scan-check', 'green'],
    ['Regresados QA', stats.rejected, 'lucide:rotate-ccw', 'danger'],
    ['Cerrados', stats.closed, 'lucide:badge-check', 'success']
  ]
  const byProduct = products.map(p => ({
    name: p.name,
    total: tickets.filter(t => t.product_id === p.id).length,
    closed: tickets.filter(t => t.product_id === p.id && t.status === 'closed').length
  }))

  return <div className="content dashboard-content">
    <div className="content-toolbar dashboard-toolbar">
      <div className="toolbar-group">
        <div className="field-control"><Icon name="lucide:calendar-range" /><select value={sprintId} onChange={e => setSprintId(e.target.value)}><option value="all">Todos los sprints</option>{sprints.map(s => <option key={s.id} value={s.id}>{s.name} · {s.status}</option>)}</select></div>
      </div>
      <div className="toolbar-group">
        {canManage && <button className="secondary-button" onClick={openSprint}><Icon name="lucide:plus" /> Sprint</button>}
        <button className="primary" onClick={openTicket}><Icon name="lucide:plus" /> Nuevo ticket</button>
      </div>
    </div>

    <div className="kpi-grid">{cards.map(([label, value, icon, tone]) => <div className={`kpi ${tone}`} key={label}><div className="kpi-icon"><Icon name={icon} size={20} /></div><div><span>{label}</span><strong>{value}</strong></div></div>)}</div>

    <div className="grid-2">
      <section className="panel"><div className="panel-heading"><div><h3>Avance por producto</h3><p>Progreso de cierre dentro del alcance seleccionado.</p></div><span className="panel-chip">{tickets.length} tickets</span></div>
        <div className="product-progress-list">{byProduct.map((x, i) => {
          const pct = x.total ? Math.round((x.closed / x.total) * 100) : 0
          return <div className="progress-item" key={x.name}><div className="progress-copy"><span className={`product-icon product-${i % 3}`}><Icon name={i % 3 === 2 ? 'lucide:smartphone' : i % 3 === 1 ? 'lucide:users-round' : 'lucide:monitor-cog'} size={16} /></span><div><b>{x.name}</b><small>{x.closed} cerrados de {x.total}</small></div><strong>{pct}%</strong></div><div className="bar"><i style={{ width: `${pct}%` }} /></div></div>
        })}</div>
      </section>

      <section className="panel"><div className="panel-heading"><div><h3>Distribución del sprint</h3><p>Tickets por etapa del flujo.</p></div></div>
        <div className="status-list">{STATUS.map(([key, label, icon]) => {
          const n = tickets.filter(t => t.status === key).length
          return <div key={key}><span className={`status-dot status-${key}`}><Icon name={icon} size={15} /></span><span>{label}</span><b>{n}</b></div>
        })}</div>
      </section>
    </div>

    <section className="panel"><div className="panel-heading"><div><h3>Tickets recientes</h3><p>Últimos movimientos dentro del workspace.</p></div></div><TicketTable tickets={tickets.slice(0, 10)} products={products} members={members} /></section>
  </div>
}

function TasksView({ tickets, products, members, sprints, sprintId, setSprintId, openTicket }) {
  return <div className="content">
    <section className="workspace-panel">
      <div className="workspace-tabs"><button className="active"><Icon name="lucide:table-2" /> Tabla</button><button onClick={() => {}}><Icon name="lucide:calendar-days" /> Calendario</button><button className="primary compact" onClick={openTicket}><Icon name="lucide:plus" /> Nuevo</button></div>
      <div className="filterbar"><div className="field-control"><Icon name="lucide:calendar-range" /><select value={sprintId} onChange={e => setSprintId(e.target.value)}><option value="all">Todos los sprints</option>{sprints.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div><span className="filter-summary">{tickets.length} tareas relacionadas contigo</span></div>
      <TicketTable tickets={tickets} products={products} members={members} />
    </section>
  </div>
}

function BoardWorkspace({ tickets, products, members, moveTicket, boardMode, setBoardMode, sprints, sprintId, setSprintId, statusFilter, setStatusFilter, assigneeFilter, setAssigneeFilter, search, setSearch, openTicket }) {
  return <div className="content board-content">
    <section className="workspace-panel board-panel">
      <div className="workspace-tabs">
        <div className="tabs-left">
          <button className={boardMode === 'table' ? 'active' : ''} onClick={() => setBoardMode('table')}><Icon name="lucide:table-2" /> Tabla</button>
          <button className={boardMode === 'kanban' ? 'active' : ''} onClick={() => setBoardMode('kanban')}><Icon name="lucide:columns-3" /> Kanban</button>
        </div>
        <button className="primary compact" onClick={openTicket}><Icon name="lucide:plus" /> Nuevo</button>
      </div>

      <div className="filterbar">
        <div className="search-control"><Icon name="lucide:search" /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar ticket" /></div>
        <div className="field-control"><Icon name="lucide:list-filter" /><select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}><option value="all">Todos los estados</option>{STATUS.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></div>
        <div className="field-control"><Icon name="lucide:user-round" /><select value={assigneeFilter} onChange={e => setAssigneeFilter(e.target.value)}><option value="all">Todos los responsables</option>{members.map(m => <option key={m.user_id} value={m.user_id}>{m.profile?.full_name || m.user_id.slice(0, 8)}</option>)}</select></div>
        <div className="field-control"><Icon name="lucide:calendar-range" /><select value={sprintId} onChange={e => setSprintId(e.target.value)}><option value="all">Todos los sprints</option>{sprints.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
      </div>

      {boardMode === 'kanban'
        ? <Board tickets={tickets} products={products} members={members} moveTicket={moveTicket} />
        : <TicketTable tickets={tickets} products={products} members={members} />}
    </section>
  </div>
}

function Board({ tickets, products, members, moveTicket }) {
  return <div className="board-wrap">{STATUS.map(([key, label, icon]) => <div className={`column column-${key}`} key={key} onDragOver={e => e.preventDefault()} onDrop={e => {
    const id = e.dataTransfer.getData('text/plain')
    const ticket = tickets.find(x => x.id === id)
    if (ticket) moveTicket(ticket, key)
  }}>
    <div className="column-head"><div><span className={`status-dot status-${key}`}><Icon name={icon} size={14} /></span><span>{label}</span><b>{tickets.filter(t => t.status === key).length}</b></div><button className="column-add"><Icon name="lucide:plus" size={17} /></button></div>
    <div className="column-body">{tickets.filter(t => t.status === key).map(t => <TicketCard key={t.id} ticket={t} product={products.find(p => p.id === t.product_id)} members={members} />)}</div>
  </div>)}</div>
}

function TicketCard({ ticket, product, members }) {
  const dev = members.find(m => m.user_id === ticket.dev_owner_id)?.profile?.full_name
  const qa = members.find(m => m.user_id === ticket.qa_owner_id)?.profile?.full_name
  const primaryOwner = dev || qa || 'Sin asignar'
  return <article className="ticket-card" draggable onDragStart={e => e.dataTransfer.setData('text/plain', ticket.id)}>
    <div className="ticket-card-top"><span className="ticket-key">{ticket.ticket_key || 'TICKET'}</span><button className="card-menu"><Icon name="lucide:ellipsis" size={17} /></button></div>
    <h4>{ticket.title}</h4>
    <div className="ticket-meta-line"><span className="mini-avatar">{initials(primaryOwner)}</span><span>{primaryOwner}</span>{ticket.due_date && <><i>•</i><span className="due-date">{formatDate(ticket.due_date)}</span></>}</div>
    <div className="card-divider"></div>
    <div className="ticket-card-footer"><span className="product-badge"><Icon name="lucide:folder" size={14} /> {product?.name || 'Producto'}</span><span className={`priority-badge priority-${ticket.priority}`}>{PRIORITY_LABELS[ticket.priority] || ticket.priority}</span></div>
  </article>
}

function TicketTable({ tickets, products, members }) {
  return <div className="table-wrap"><div className="table modern-table">
    <div className="tr th"><span>Ticket</span><span>Proyecto</span><span>Responsable</span><span>Fecha límite</span><span>Estado</span><span></span></div>
    {tickets.length === 0 && <div className="table-empty"><Icon name="lucide:inbox" size={30} /><b>No hay tickets</b><span>Ajusta los filtros o crea uno nuevo.</span></div>}
    {tickets.map(t => {
      const product = products.find(p => p.id === t.product_id)
      const dev = members.find(m => m.user_id === t.dev_owner_id)?.profile?.full_name
      const qa = members.find(m => m.user_id === t.qa_owner_id)?.profile?.full_name
      const owner = dev || qa || 'Sin asignar'
      return <div className="tr" key={t.id}>
        <span className="task-cell"><b>{t.title}</b><small>{t.ticket_key} · {TYPE_LABELS[t.type] || t.type}</small></span>
        <span><span className="product-cell-icon"><Icon name="lucide:folder" size={14} /></span>{product?.name || '—'}</span>
        <span className="assignee-cell"><span className="mini-avatar">{initials(owner)}</span>{owner}</span>
        <span>{formatDate(t.due_date)}</span>
        <span><span className={`status-badge status-badge-${t.status}`}><Icon name={statusIcon(t.status)} size={13} />{statusLabel(t.status)}</span></span>
        <span><button className="icon-button"><Icon name="lucide:ellipsis-vertical" size={17} /></button></span>
      </div>
    })}
  </div></div>
}

function Team({ members, canManage, openInvite }) {
  return <div className="content"><section className="workspace-panel team-panel">
    <div className="panel-heading team-heading"><div><h3>Equipo</h3><p>Roles y colaboradores con acceso al workspace.</p></div>{canManage && <button className="primary" onClick={openInvite}><Icon name="lucide:user-plus" /> Invitar colaborador</button>}</div>
    <div className="member-grid">{members.map(m => <div className="member-card" key={m.user_id}><div className="avatar">{initials(m.profile?.full_name)}</div><div className="member-info"><b>{m.profile?.full_name || 'Usuario'}</b><span>{m.profile?.job_title || 'Colaborador'}</span></div><em>{m.role.toUpperCase()}</em><button className="icon-button"><Icon name="lucide:ellipsis-vertical" size={17} /></button></div>)}</div>
  </section></div>
}

function Modal({ title, onClose, children }) {
  return <div className="modal-backdrop" onMouseDown={onClose}><div className="modal" onMouseDown={e => e.stopPropagation()}><div className="modal-head"><div><span className="modal-kicker">JIRA INTERNO</span><h3>{title}</h3></div><button className="icon-button" onClick={onClose}><Icon name="lucide:x" size={20} /></button></div>{children}</div></div>
}

function TicketModal({ workspace, products, sprints, members, user, onClose, onSaved }) {
  const [form, setForm] = useState({ product_id: products[0]?.id || '', sprint_id: '', title: '', description: '', type: 'task', priority: 'medium', dev_owner_id: '', qa_owner_id: '', story_points: '', due_date: '' })
  const [err, setErr] = useState('')
  const save = async e => {
    e.preventDefault()
    const payload = {
      ...form,
      workspace_id: workspace.id,
      reporter_id: user.id,
      sprint_id: form.sprint_id || null,
      dev_owner_id: form.dev_owner_id || null,
      qa_owner_id: form.qa_owner_id || null,
      story_points: form.story_points === '' ? null : Number(form.story_points),
      due_date: form.due_date || null
    }
    const { error } = await db.from('tickets').insert(payload)
    if (error) setErr(error.message)
    else onSaved()
  }
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  return <Modal title="Crear ticket" onClose={onClose}><form className="form" onSubmit={save}>
    <label>Título<input value={form.title} onChange={e => set('title', e.target.value)} required placeholder="Describe el trabajo de forma breve" /></label>
    <label>Descripción<textarea rows="4" value={form.description} onChange={e => set('description', e.target.value)} placeholder="Contexto, criterios de aceptación, pasos para reproducir..." /></label>
    <div className="form-grid">
      <label>Producto<select value={form.product_id} onChange={e => set('product_id', e.target.value)} required>{products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
      <label>Sprint<select value={form.sprint_id} onChange={e => set('sprint_id', e.target.value)}><option value="">Backlog / sin sprint</option>{sprints.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
      <label>Tipo<select value={form.type} onChange={e => set('type', e.target.value)}>{TYPES.map(x => <option key={x} value={x}>{TYPE_LABELS[x]}</option>)}</select></label>
      <label>Prioridad<select value={form.priority} onChange={e => set('priority', e.target.value)}>{PRIORITIES.map(x => <option key={x} value={x}>{PRIORITY_LABELS[x]}</option>)}</select></label>
      <label>Responsable Dev<select value={form.dev_owner_id} onChange={e => set('dev_owner_id', e.target.value)}><option value="">Sin asignar</option>{members.filter(m => ['dev', 'admin', 'pm'].includes(m.role)).map(m => <option key={m.user_id} value={m.user_id}>{m.profile?.full_name || m.user_id.slice(0, 8)}</option>)}</select></label>
      <label>Responsable QA<select value={form.qa_owner_id} onChange={e => set('qa_owner_id', e.target.value)}><option value="">Sin asignar</option>{members.filter(m => ['qa', 'admin', 'pm'].includes(m.role)).map(m => <option key={m.user_id} value={m.user_id}>{m.profile?.full_name || m.user_id.slice(0, 8)}</option>)}</select></label>
      <label>Story points<input type="number" min="0" step="0.5" value={form.story_points} onChange={e => set('story_points', e.target.value)} placeholder="0" /></label>
      <label>Fecha límite<input type="date" value={form.due_date} onChange={e => set('due_date', e.target.value)} /></label>
    </div>
    {err && <div className="error"><Icon name="lucide:triangle-alert" /> {err}</div>}
    <div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>Cancelar</button><button className="primary"><Icon name="lucide:plus" /> Crear ticket</button></div>
  </form></Modal>
}

function SprintModal({ workspace, user, onClose, onSaved }) {
  const [f, setF] = useState({ name: '', goal: '', start_date: '', end_date: '', status: 'planned' })
  const save = async e => {
    e.preventDefault()
    const { error } = await db.from('sprints').insert({ ...f, workspace_id: workspace.id, created_by: user.id, start_date: f.start_date || null, end_date: f.end_date || null })
    if (error) alert(error.message)
    else onSaved()
  }
  return <Modal title="Nuevo sprint" onClose={onClose}><form className="form" onSubmit={save}>
    <label>Nombre<input required value={f.name} onChange={e => setF({ ...f, name: e.target.value })} placeholder="Sprint 01 · Noviembre" /></label>
    <label>Objetivo<textarea value={f.goal} onChange={e => setF({ ...f, goal: e.target.value })} placeholder="Objetivo principal del sprint" /></label>
    <div className="form-grid"><label>Inicio<input type="date" value={f.start_date} onChange={e => setF({ ...f, start_date: e.target.value })} /></label><label>Fin<input type="date" value={f.end_date} onChange={e => setF({ ...f, end_date: e.target.value })} /></label><label>Estado<select value={f.status} onChange={e => setF({ ...f, status: e.target.value })}><option value="planned">Planeado</option><option value="active">Activo</option><option value="completed">Completado</option></select></label></div>
    <div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>Cancelar</button><button className="primary"><Icon name="lucide:save" /> Guardar sprint</button></div>
  </form></Modal>
}

function InviteModal({ workspace, onClose, onSaved }) {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('dev')
  const [msg, setMsg] = useState('')
  const send = async e => {
    e.preventDefault()
    setMsg('Enviando invitación…')
    const { data, error } = await db.functions.invoke('invite-member', { body: { email, role, workspace_id: workspace.id, redirect_to: getAppUrl() } })
    if (error || data?.error) setMsg(error?.message || data.error)
    else { setMsg('Invitación enviada correctamente.'); setTimeout(onSaved, 500) }
  }
  return <Modal title="Invitar colaborador" onClose={onClose}><form className="form" onSubmit={send}>
    <label>Correo<input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="colaborador@trobbu.com" /></label>
    <label>Rol<select value={role} onChange={e => setRole(e.target.value)}><option value="dev">Desarrollo</option><option value="qa">QA</option><option value="pm">PM</option><option value="viewer">Solo lectura</option><option value="admin">Administrador</option></select></label>
    {msg && <div className="notice">{msg}</div>}
    <div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>Cancelar</button><button className="primary"><Icon name="lucide:send" /> Enviar invitación</button></div>
  </form></Modal>
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode><App /></React.StrictMode>
)
