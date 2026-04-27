'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  Monitor, 
  Layers, 
  Database, 
  Globe, 
  Terminal as TerminalIcon, 
  GitBranch, 
  RotateCcw, 
  HelpCircle,
  ArrowRight,
  FileText,
  Info,
  BookOpen,
  Search,
  Code,
  Zap
} from 'lucide-react';
import '../app/GitVisualizer.css';
import '../app/BeginnerHelpers.css';

// --- Types ---
type GitFile = {
  id: string;
  name: string;
  status: 'untracked' | 'staged' | 'committed';
};

type Commit = {
  id: string;
  hash: string;
  message: string;
  files: string[];
  branch: string;
  timestamp: number;
};

type GitState = {
  isInitialized: boolean;
  workingDirectory: GitFile[];
  stagingArea: GitFile[];
  localRepo: Commit[];
  remoteRepo: Commit[];
  currentBranch: string;
  branches: string[];
  head: string | null;
  remotes: { name: string, url: string }[];
};

type CommandInfo = {
  cmd: string;
  desc: string;
  explanation: string;
  category: 'Basics' | 'Branches' | 'Remote' | 'History' | 'Cleanup';
};

const COMMAND_LIBRARY: CommandInfo[] = [
  { cmd: 'git init', desc: 'Start a new repo', explanation: 'Creates a hidden .git folder where Git saves all history.', category: 'Basics' },
  { cmd: 'git add .', desc: 'Stage all files', explanation: 'Moves files from your computer to the "Waiting Room" (Staging Area).', category: 'Basics' },
  { cmd: 'git commit -m "msg"', desc: 'Save a snapshot', explanation: 'Takes everything in Staging and saves it permanently in the Local Repo.', category: 'Basics' },
  { cmd: 'git status', desc: 'Check current state', explanation: 'Shows which files are modified, staged, or untracked.', category: 'Basics' },
  { cmd: 'git branch [name]', desc: 'Create a branch', explanation: 'Creates a new parallel timeline for your work.', category: 'Branches' },
  { cmd: 'git checkout [name]', desc: 'Switch branch', explanation: 'Jumps to another branch or timeline.', category: 'Branches' },
  { cmd: 'git merge [name]', desc: 'Combine work', explanation: 'Brings changes from another branch into your current one.', category: 'Branches' },
  { cmd: 'git remote add origin [url]', desc: 'Connect to GitHub', explanation: 'Links your local computer to a server like GitHub.', category: 'Remote' },
  { cmd: 'git push', desc: 'Upload changes', explanation: 'Sends your local commits to the server (Remote Repo).', category: 'Remote' },
  { cmd: 'git pull', desc: 'Download changes', explanation: 'Fetches work from the server and merges it into your local code.', category: 'Remote' },
  { cmd: 'git fetch', desc: 'Check for updates', explanation: 'Sees what others did on the server without changing your files.', category: 'Remote' },
  { cmd: 'git clone [url]', desc: 'Download a repo', explanation: 'Copies an entire project from the server to your computer.', category: 'Basics' },
  { cmd: 'git log', desc: 'View history', explanation: 'Lists all the commits made in this project.', category: 'History' },
  { cmd: 'git diff', desc: 'See changes', explanation: 'Shows exactly what lines of code you changed.', category: 'History' },
  { cmd: 'git stash', desc: 'Pause work', explanation: 'Temporarily puts away changes so you can switch tasks.', category: 'Cleanup' },
  { cmd: 'git reset --hard', desc: 'Wipe all changes', explanation: '⚠️ Deletes all uncommitted work and returns to the last save.', category: 'Cleanup' },
  { cmd: 'git revert [hash]', desc: 'Undo a commit', explanation: 'Creates a new commit that does the opposite of an old one.', category: 'History' },
  { cmd: 'git rebase [branch]', desc: 'Rewrite history', explanation: 'Moves your current work on top of another branch for a cleaner history.', category: 'Branches' },
  { cmd: 'git cherry-pick [hash]', desc: 'Pick one commit', explanation: 'Grabs a specific commit from another branch and adds it to yours.', category: 'Branches' },
  { cmd: 'git stash pop', desc: 'Restore paused work', explanation: 'Brings back the changes you temporarily put away with git stash.', category: 'Cleanup' },
  { cmd: 'git rm [file]', desc: 'Remove file', explanation: 'Deletes a file from both your folder and Git tracking.', category: 'Basics' },
  { cmd: 'git mv [src] [dest]', desc: 'Move/Rename file', explanation: 'Moves or renames a file while keeping its history intact.', category: 'Basics' },
  { cmd: 'git remote -v', desc: 'List remotes', explanation: 'Shows the URLs of the servers your project is linked to.', category: 'Remote' },
  { cmd: 'git config --global user.name', desc: 'Set identity', explanation: 'Tells Git who you are so your commits have your name.', category: 'Basics' },
  { cmd: 'git show [hash]', desc: 'View commit details', explanation: 'Shows the exact changes made in a specific commit.', category: 'History' },
  { cmd: 'git checkout HEAD~1', desc: 'Go back in time', explanation: 'Moves your files back to how they were one save ago (Read-only).', category: 'History' },
  { cmd: 'git merge --abort', desc: 'Cancel merge', explanation: 'Stops a merge if there are conflicts and returns to normal.', category: 'Branches' },
];

// --- Main Component ---
export default function GitVisualizer() {
  const [state, setState] = useState<GitState>({
    isInitialized: false,
    workingDirectory: [],
    stagingArea: [],
    localRepo: [],
    remoteRepo: [],
    currentBranch: 'main',
    branches: ['main'],
    head: null,
    remotes: []
  });

  const [logs, setLogs] = useState<{ type: 'cmd' | 'info' | 'error', text: string }[]>([
    { type: 'info', text: 'Welcome to GitVision. Type "git init" to start your project.' }
  ]);

  const [input, setInput] = useState('');
  const [hint, setHint] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const terminalEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const addLog = (type: 'cmd' | 'info' | 'error', text: string) => {
    setLogs(prev => [...prev, { type, text }]);
  };

  const handleCommand = (cmd: string) => {
    const trimmed = cmd.trim();
    if (!trimmed) return;

    addLog('cmd', `~/project $ ${trimmed}`);
    setInput('');

    const parts = trimmed.split(' ');
    const base = parts[0];
    const sub = parts[1];

    // Find explanation for hint
    const cmdInfo = COMMAND_LIBRARY.find(c => trimmed.startsWith(c.cmd.split('[')[0].trim()));
    if (cmdInfo) {
      setHint(cmdInfo.explanation);
      setTimeout(() => setHint(null), 5000);
    }

    if (base === 'git') {
      if (sub === 'init') {
        if (state.isInitialized) {
          addLog('error', 'Reinitialized existing Git repository.');
        } else {
          setState(prev => ({ ...prev, isInitialized: true }));
          addLog('info', 'Initialized empty Git repository in /project/.git/');
        }
      } else if (!state.isInitialized && sub !== 'clone') {
        addLog('error', 'fatal: not a git repository (or any of the parent directories): .git');
      } else {
        handleGitSubcommands(parts.slice(1));
      }
    } else if (base === 'touch') {
      const fileName = parts[1] || 'newfile.txt';
      setState(prev => ({
        ...prev,
        workingDirectory: [...prev.workingDirectory, { id: Math.random().toString(), name: fileName, status: 'untracked' }]
      }));
      addLog('info', `Created file: ${fileName}`);
    } else if (base === 'clear') {
      setLogs([]);
    } else {
      addLog('error', `Command not found: ${base}. Try "git init" or "touch file.txt"`);
    }
  };

  const handleGitSubcommands = (parts: string[]) => {
    const sub = parts[0];
    
    switch (sub) {
      case 'add':
        const target = parts[1];
        if (target === '.' || target === '-A') {
          setState(prev => ({
            ...prev,
            stagingArea: [...prev.stagingArea, ...prev.workingDirectory.map(f => ({ ...f, status: 'staged' as const }))],
            workingDirectory: []
          }));
          addLog('info', 'Added all files to staging area.');
        } else {
          const file = state.workingDirectory.find(f => f.name === target);
          if (file) {
            setState(prev => ({
              ...prev,
              workingDirectory: prev.workingDirectory.filter(f => f.name !== target),
              stagingArea: [...prev.stagingArea, { ...file, status: 'staged' }]
            }));
            addLog('info', `Added ${target} to staging area.`);
          } else {
            addLog('error', `pathspec '${target}' did not match any files`);
          }
        }
        break;

      case 'commit':
        if (state.stagingArea.length === 0) {
          addLog('error', 'nothing to commit, working tree clean');
          return;
        }
        const msgIndex = parts.indexOf('-m');
        const message = msgIndex !== -1 ? parts.slice(msgIndex + 1).join(' ').replace(/['"]/g, '') : 'Manual commit';
        
        const newCommit: Commit = {
          id: Math.random().toString(36).substr(2, 9),
          hash: Math.random().toString(36).substr(2, 7),
          message,
          files: state.stagingArea.map(f => f.name),
          branch: state.currentBranch,
          timestamp: Date.now(),
        };

        setState(prev => ({
          ...prev,
          stagingArea: [],
          localRepo: [...prev.localRepo, newCommit],
          head: newCommit.id
        }));
        addLog('info', `[${state.currentBranch} ${newCommit.hash}] ${message}`);
        break;

      case 'branch':
        if (parts.length === 1) {
          addLog('info', state.branches.map(b => (b === state.currentBranch ? `* ${b}` : `  ${b}`)).join('\n'));
        } else {
          const newBranch = parts[1];
          setState(prev => ({ ...prev, branches: [...prev.branches, newBranch] }));
          addLog('info', `Created branch '${newBranch}'`);
        }
        break;

      case 'checkout':
        const bName = parts[1] === '-b' ? parts[2] : parts[1];
        if (state.branches.includes(bName)) {
          setState(prev => ({ ...prev, currentBranch: bName }));
          addLog('info', `Switched to branch '${bName}'`);
        } else if (parts[1] === '-b') {
          setState(prev => ({ ...prev, branches: [...prev.branches, bName], currentBranch: bName }));
          addLog('info', `Switched to a new branch '${bName}'`);
        } else {
          addLog('error', `error: pathspec '${bName}' did not match any file(s) known to git`);
        }
        break;

      case 'remote':
        if (parts[1] === 'add') {
          const rName = parts[2];
          const rUrl = parts[3];
          setState(prev => ({ ...prev, remotes: [...prev.remotes, { name: rName, url: rUrl }] }));
          addLog('info', `Remote '${rName}' added.`);
        }
        break;

      case 'push':
        if (state.localRepo.length === 0) {
          addLog('info', 'Everything up-to-date');
          return;
        }
        setState(prev => ({ ...prev, remoteRepo: [...prev.localRepo] }));
        addLog('info', 'Uploading to remote server... Done.');
        break;

      case 'clone':
        setState(prev => ({ ...prev, isInitialized: true, remoteRepo: [], workingDirectory: [{ id: 'c1', name: 'README.md', status: 'untracked' }] }));
        addLog('info', 'Cloning into \'repo\'...\nremote: Enumerating objects: 3, done.\nReceiving objects: 100% (3/3), done.');
        break;

      case 'status':
        if (state.workingDirectory.length === 0 && state.stagingArea.length === 0) {
          addLog('info', `On branch ${state.currentBranch}\nnothing to commit, working tree clean`);
        } else {
          let out = `On branch ${state.currentBranch}\nChanges to be committed: ${state.stagingArea.length}\nUntracked files: ${state.workingDirectory.length}`;
          addLog('info', out);
        }
        break;

      case 'log':
        addLog('info', state.localRepo.map(c => `commit ${c.hash}\n${c.message}`).join('\n\n') || 'No commits yet.');
        break;

      case 'reset':
        if (parts.includes('--hard')) {
          setState(prev => ({ ...prev, workingDirectory: [], stagingArea: [] }));
          addLog('info', 'HEAD is now at ' + (state.head || 'initial'));
        }
        break;

      default:
        addLog('error', `git ${sub} is simulated in basic mode for this demo.`);
    }
  };

  const filteredCommands = COMMAND_LIBRARY.filter(c => 
    c.cmd.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.desc.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="app-layout">
      {/* Sidebar: Command Reference for Beginners */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="logo-container">
             <div className="logo-icon"><Zap size={20} color="white" /></div>
             <h2 className="logo-text" style={{ fontSize: '1.25rem' }}>GitGuide</h2>
          </div>
          <p className="concept-desc" style={{ marginTop: '0.5rem' }}>A visual encyclopedia for Git beginners.</p>
        </div>

        <div className="sidebar-content">
          <div style={{ position: 'relative', marginBottom: '1.5rem' }}>
            <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }} />
            <input 
              type="text" 
              placeholder="Search commands..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '0.5rem 0.5rem 0.5rem 2rem', color: 'white', fontSize: '0.875rem' }}
            />
          </div>

          <div className="command-list">
            <h3 className="column-title" style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <BookOpen size={14} /> Command Library
            </h3>
            {filteredCommands.map(c => (
              <div key={c.cmd} className="concept-card" style={{ cursor: 'pointer' }} onClick={() => handleCommand(c.cmd.split('[')[0].trim())}>
                <div className="concept-title">
                  <Code size={14} /> {c.cmd}
                </div>
                <div className="concept-desc">{c.desc}</div>
                <div style={{ fontSize: '0.65rem', marginTop: '0.4rem', opacity: 0.5 }}>{c.category}</div>
              </div>
            ))}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="visualizer-container" style={{ flex: 1 }}>
        <header className="visualizer-header">
          <div className="logo-container">
            <h1 className="logo-text">GitVision <span style={{ fontSize: '0.75rem', verticalAlign: 'middle', background: '#2563eb', padding: '2px 6px', borderRadius: '4px', marginLeft: '8px' }}>LEARNER</span></h1>
          </div>
          <div className="header-actions">
            <div style={{ display: 'flex', alignItems: 'center', gap: '2rem', marginRight: '2rem' }}>
               <div className="flex items-center gap-1"><span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#60a5fa', display: 'inline-block' }}></span> <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>Local</span></div>
               <div className="flex items-center gap-1"><span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#fbbf24', display: 'inline-block' }}></span> <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>Remote</span></div>
            </div>
            <button onClick={() => window.location.reload()} className="action-btn"><RotateCcw size={16} /> Reset</button>
            <button className="action-btn"><Globe size={16} /> GitHub Docs</button>
          </div>
        </header>

        <main className="main-content">
          {/* Concept Explainer Tooltip */}
          {hint && (
            <div className="command-help-box">
              <Info size={20} />
              <div>
                <div style={{ fontWeight: 'bold' }}>Git Explain</div>
                <div style={{ fontSize: '0.75rem', opacity: 0.9 }}>{hint}</div>
              </div>
            </div>
          )}

        <div className="visualizer-grid-container">
          <div className="visualizer-grid">
            <Column title="Working Directory" icon={<Monitor size={20} color="#60a5fa" />} className="wd">
              <div className="concept-desc" style={{ marginBottom: '1rem', fontSize: '0.7rem' }}>Your actual computer files. This is where you write code.</div>
              {state.workingDirectory.map(file => (
                <FileItem key={file.id} file={file} type="untracked" />
              ))}
              {state.workingDirectory.length === 0 && <EmptyState text="No local files" />}
            </Column>

            <Column title="Staging Area" icon={<Layers size={20} color="#22d3ee" />} className="staging">
              <div className="concept-desc" style={{ marginBottom: '1rem', fontSize: '0.7rem' }}>The "Waiting Room". Files here are ready to be saved.</div>
              {state.stagingArea.map(file => (
                <FileItem key={file.id} file={file} type="staged" />
              ))}
              {state.stagingArea.length === 0 && <EmptyState text="Empty index" />}
            </Column>

            <Column title="Local Repository" icon={<Database size={20} color="#34d399" />} className="local">
              <div className="concept-desc" style={{ marginBottom: '1rem', fontSize: '0.7rem' }}>Your project's history. Every save is stored here forever.</div>
              <div style={{ display: 'flex', flexDirection: 'column-reverse', gap: '1rem' }}>
                {state.localRepo.map(commit => (
                  <CommitNode key={commit.id} commit={commit} isHead={state.head === commit.id} />
                ))}
              </div>
              {state.localRepo.length === 0 && <EmptyState text="No history yet" />}
            </Column>

            <Column title="Remote Repository" icon={<Globe size={20} color="#fbbf24" />} className="remote">
              <div className="concept-desc" style={{ marginBottom: '1rem', fontSize: '0.7rem' }}>The server (e.g. GitHub). This keeps your work safe online.</div>
               <div style={{ display: 'flex', flexDirection: 'column-reverse', gap: '1rem' }}>
                {state.remoteRepo.map(commit => (
                  <CommitNode key={commit.id} commit={commit} isRemote />
                ))}
              </div>
              {state.remoteRepo.length === 0 && <EmptyState text="Not connected" />}
            </Column>
          </div>
        </div>

          <div className="terminal-section">
            <div className="terminal-window">
              <div className="terminal-top">
                <div className="terminal-dots">
                  <span className="dot red"></span>
                  <span className="dot yellow"></span>
                  <span className="dot green"></span>
                </div>
                <div style={{ fontSize: '0.75rem', opacity: 0.5, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <TerminalIcon size={12} /> terminal
                </div>
              </div>

              <div className="terminal-output">
                {logs.map((log, i) => (
                  <div key={i} style={{ 
                    color: log.type === 'cmd' ? '#22d3ee' : log.type === 'error' ? '#f87171' : '#94a3b8',
                    marginBottom: '0.25rem'
                  }}>
                    {log.text}
                  </div>
                ))}
                <div ref={terminalEndRef} />
              </div>

              <div className="terminal-input-bar">
                <span style={{ color: '#22d3ee', fontWeight: 'bold' }}>~/project $</span>
                <input 
                  type="text" 
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCommand(input)}
                  className="terminal-input"
                  placeholder="type here (e.g. git init)"
                  autoFocus
                />
              </div>
            </div>
            
            <div className="quick-actions">
              <span style={{ fontSize: '0.75rem', color: '#94a3b8', marginRight: '0.5rem' }}>Beginner Path:</span>
              {['git init', 'touch app.js', 'git add .', 'git commit -m "first save"', 'git push'].map(cmd => (
                <button key={cmd} onClick={() => handleCommand(cmd)} className="chip">{cmd}</button>
              ))}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

// --- Sub-components ---

function Column({ title, icon, className, children }: { title: string, icon: React.ReactNode, className: string, children: React.ReactNode }) {
  return (
    <div className={`column ${className}`}>
      <div className="column-header">
        {icon}
        <h2 className="column-title">{title}</h2>
      </div>
      <div className="column-content">
        {children}
      </div>
    </div>
  );
}

function FileItem({ file, type }: { file: GitFile, type: 'untracked' | 'staged' }) {
  return (
    <div className="file-item">
      <FileText size={16} color={type === 'untracked' ? '#64748b' : '#06b6d4'} />
      <span className="file-name">{file.name}</span>
      <div className={`file-status-dot ${type === 'untracked' ? 'dot-untracked' : 'dot-staged'}`} />
    </div>
  );
}

function CommitNode({ commit, isHead, isRemote }: { commit: Commit, isHead?: boolean, isRemote?: boolean }) {
  return (
    <div className={`commit-node ${isRemote ? 'remote' : ''}`}>
      {!isRemote && isHead && (
        <div className="head-marker">
          <ArrowRight size={14} /> HEAD
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
        <span style={{ fontFamily: 'monospace', fontSize: '0.75rem', opacity: 0.6 }}>{commit.hash}</span>
        <span style={{ fontSize: '0.625rem', opacity: 0.4 }}>{new Date(commit.timestamp).toLocaleTimeString()}</span>
      </div>
      <p style={{ fontSize: '0.875rem', fontWeight: 500, margin: 0 }}>{commit.message}</p>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569', fontStyle: 'italic', fontSize: '0.875rem' }}>
      {text}
    </div>
  );
}
