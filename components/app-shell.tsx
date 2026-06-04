'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTheme } from 'next-themes';
import { Icon } from '@/components/icon';
import {
  NAV,
  ENTITIES,
  ROLES,
  CMD_ACTIONS,
  CMD_RECENT,
  CMD_NAV,
} from '@/lib/data/shell';
import { setViewingActor } from '@/lib/actions/session';

function Logo({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-label="Settle">
      <rect width="100" height="100" rx="23" fill="#5E6AD2" />
      <path
        d="M68 36 C68 27 60 23 50 23 C39 23 31 28 31 37 C31 46 40 49 50 51 C60 53 69 56 69 66 C69 76 60 80 50 80 C40 80 32 76 32 67"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="12.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Sidebar() {
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/');
  return (
    <aside className="sidebar">
      <Link href="/dashboard" className="sb-brand">
        <Logo />
        <span className="sb-name">Settle</span>
      </Link>
      <div className="sb-section">Payables</div>
      <nav className="nav">
        {NAV.map((it) => (
          <Link key={it.id} href={it.href} className={'navitem' + (isActive(it.href) ? ' active' : '')}>
            <Icon name={it.icon} size={17} />
            <span className="lbl">{it.label}</span>
            {it.sub && <span className="nsub">{it.sub}</span>}
            {it.review != null && <span className="nav-badge review">{it.review}</span>}
            {it.count != null && <span className="nav-badge count">{it.count}</span>}
          </Link>
        ))}
      </nav>
      <div className="sb-foot">
        <Link href="/settings" className={'navitem' + (isActive('/settings') ? ' active' : '')}>
          <Icon name="settings" size={17} />
          <span className="lbl">Settings</span>
        </Link>
        <div className="sb-sync">
          <span className="dot" />
          <span>Last synced 2 min ago</span>
        </div>
      </div>
    </aside>
  );
}

function Topbar({ onSearch }: { onSearch: () => void }) {
  const router = useRouter();
  const [menu, setMenu] = useState<'entity' | 'role' | null>(null);
  const [entityIdx, setEntityIdx] = useState(0);
  const [roleIdx, setRoleIdx] = useState(0);
  const { resolvedTheme, setTheme } = useTheme();

  const entity = ENTITIES[entityIdx];
  const role = ROLES[roleIdx];

  return (
    <header className="topbar">
      <div style={{ position: 'relative' }}>
        <button className="entity" onClick={() => setMenu(menu === 'entity' ? null : 'entity')}>
          <span className="mono">{entity.mono}</span>
          <span className="n">{entity.name}</span>
          <Icon name="chevrons-up-down" size={15} className="chev" />
        </button>
        {menu === 'entity' && (
          <div className="menu" style={{ top: 'calc(100% + 7px)', left: 0 }}>
            <div className="menu-label">Switch entity</div>
            {ENTITIES.map((e, i) => (
              <div key={e.id} className="menu-item" onClick={() => { setEntityIdx(i); setMenu(null); }}>
                <span className="mono">{e.mono}</span>
                <span className="m">
                  <span className="t">{e.name}</span>
                  <span className="d">{e.sub}</span>
                </span>
                {i === entityIdx && <Icon name="check" size={16} className="check" />}
              </div>
            ))}
            <div className="menu-sep" />
            <div className="menu-foot"><Icon name="plus" size={15} />Add entity</div>
          </div>
        )}
      </div>

      <div className="tb-spacer" />

      <button className="searchbtn" onClick={onSearch}>
        <Icon name="search" size={15} />
        <span className="ph">Search bills, vendors, GL codes…</span>
        <span className="kbd">⌘K</span>
      </button>

      <button
        className="iconbtn"
        onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
        title="Toggle theme"
        aria-label="Toggle theme"
      >
        <Icon name="moon" size={17} className="theme-icon theme-icon--light" />
        <Icon name="sun" size={17} className="theme-icon theme-icon--dark" />
      </button>

      <div style={{ position: 'relative' }}>
        <button className="role" onClick={() => setMenu(menu === 'role' ? null : 'role')}>
          <span className="av">{role.mono}</span>
          <span className="meta">
            <span className="cap">Viewing as</span>
            <span className="r">{role.role}</span>
          </span>
          <Icon name="chevron-down" size={15} className="chev" />
        </button>
        {menu === 'role' && (
          <div className="menu" style={{ top: 'calc(100% + 7px)', right: 0 }}>
            <div className="menu-label">Viewing as</div>
            {ROLES.map((r, i) => (
              <div key={r.id} className="menu-item" onClick={() => { setRoleIdx(i); setMenu(null); void setViewingActor(r.userId); }}>
                <span className="av">{r.mono}</span>
                <span className="m">
                  <span className="t">{r.role} · {r.name}</span>
                  <span className="d">{r.desc}</span>
                </span>
                {i === roleIdx && <Icon name="check" size={16} className="check" />}
              </div>
            ))}
            <div className="menu-sep" />
            <div className="menu-foot"><Icon name="log-out" size={15} />Sign out</div>
          </div>
        )}
      </div>

      <div className="tb-divider" />
      <button className="btn btn-primary" onClick={() => router.push('/bills/new')}><Icon name="plus" size={15} />New bill</button>

      {menu && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 50 }}
          onClick={() => setMenu(null)}
          aria-hidden
        />
      )}
    </header>
  );
}

type CmdItem = {
  id: string;
  label: string;
  icon: string;
  type: 'action' | 'recent' | 'nav';
  sub?: string;
  keys?: string[];
  hint?: string;
  href?: string;
};

function CommandPalette({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 30);
    return () => clearTimeout(t);
  }, []);

  const ql = q.trim().toLowerCase();
  const groups = useMemo(() => {
    const match = (s: string) => s.toLowerCase().includes(ql);
    const g: { key: string; items: CmdItem[] }[] = [];
    const acts: CmdItem[] = CMD_ACTIONS.filter((a) => match(a.label)).map((a) => ({
      id: a.id, label: a.label, icon: a.icon, type: 'action', keys: a.keys,
    }));
    const rec: CmdItem[] = CMD_RECENT.filter((r) => match(r.label) || match(r.sub)).map((r) => ({
      id: r.id, label: r.label, icon: r.icon, type: 'recent', sub: r.sub,
    }));
    const nav: CmdItem[] = CMD_NAV.filter((n) => match(n.label)).map((n) => ({
      id: n.id, label: n.label, icon: n.icon, type: 'nav', hint: n.hint, href: n.href,
    }));
    if (acts.length) g.push({ key: 'Actions', items: acts });
    if (rec.length) g.push({ key: 'Recent', items: rec });
    if (nav.length) g.push({ key: 'Navigate', items: nav });
    return g;
  }, [ql]);

  const flat = useMemo(() => groups.flatMap((g) => g.items), [groups]);

  const run = (item?: CmdItem) => {
    if (item?.type === 'nav' && item.href) router.push(item.href);
    else if (item?.type === 'action') {
      if (item.id === 'newbill') router.push('/bills/new');
      else if (item.id === 'record') router.push('/payments');
      else if (item.id === 'vendor') router.push('/vendors');
    }
    onClose();
  };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, flat.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); run(flat[active]); }
  };

  let idx = -1;
  return (
    <div className="cmdk-scrim" onClick={onClose}>
      <div className="cmdk" onClick={(e) => e.stopPropagation()}>
        <div className="cmdk-search">
          <Icon name="search" size={18} />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setActive(0);
            }}
            onKeyDown={onKey}
            placeholder="Search bills, vendors, GL codes, actions…"
          />
          <span className="kbd">esc</span>
        </div>
        <div className="cmdk-list">
          {flat.length === 0 && <div className="cmdk-empty">No results for “{q}”.</div>}
          {groups.map((g) => (
            <div className="cmdk-group" key={g.key}>
              <div className="gl">{g.key}</div>
              {g.items.map((item) => {
                idx++;
                const isActive = idx === active;
                const me = idx;
                return (
                  <div
                    key={item.id}
                    className={'cmdk-item' + (isActive ? ' active' : '')}
                    onMouseEnter={() => setActive(me)}
                    onClick={() => run(item)}
                  >
                    <Icon name={item.icon} size={17} />
                    <span className="ci-main">
                      <span className="t">{item.label}</span>
                      {item.sub && <span className="s">{item.sub}</span>}
                    </span>
                    <span className="ik">
                      {item.keys && item.keys.map((k, i) => <span className="kbd" key={i}>{k}</span>)}
                      {item.hint && <span className="kbd">{item.hint}</span>}
                      {isActive && !item.keys && !item.hint && <span className="enter">↵</span>}
                    </span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
        <div className="cmdk-foot">
          <span className="fi"><span className="kbd">↑</span><span className="kbd">↓</span>Navigate</span>
          <span className="fi"><span className="kbd">↵</span>Open</span>
          <span className="fi"><span className="kbd">esc</span>Close</span>
          <span className="grow" />
          <span className="fi">Summit Waste Services</span>
        </div>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [cmdkOpen, setCmdkOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCmdkOpen((o) => !o);
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        router.push('/bills/new');
      } else if (e.key === 'Escape') {
        setCmdkOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [router]);

  return (
    <div className="app">
      <Sidebar />
      <div className="main">
        <Topbar onSearch={() => setCmdkOpen(true)} />
        <div className="content">{children}</div>
      </div>
      {cmdkOpen && <CommandPalette onClose={() => setCmdkOpen(false)} />}
    </div>
  );
}
