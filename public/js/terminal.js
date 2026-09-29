// A cosmetic, client-side virtual Linux server: ls/cd/cat/df/systemctl/etc.
// against an in-memory fake filesystem, so trainees get instant, realistic
// terminal output. It never decides whether a step is "correct" or scores
// anything -- that judgment always comes from the server (see trainee.js).
function makeSandbox() {
  let cwd, F, nginx, disk, users;

  function fresh() {
    cwd = '/home/trainee';
    nginx = false;
    disk = 91;
    users = {};
    F = {
      '/home/trainee/notes.txt': { c: 'Welcome to the team! Pick an SOP on the left.', p: '-rw-r--r--', s: '48' },
      '/home/trainee/backup.sh': { c: '#!/bin/bash\ntar czf /backup/data.tgz /var/www', p: '-rw-r--r--', s: '52' },
      '/var/log/app.log': { c: 'INFO service started\nWARN disk usage 91%\nERROR write failed: no space left on device', p: '-rw-r--r--', s: '340M' },
      '/var/log/app.log.1': { c: '(old rotated log, safe to delete)', p: '-rw-r--r--', s: '2.1G' },
      '/var/log/nginx/error.log': { c: '[emerg] worker process 4121 exited on signal 9\n[crit] stale pid file /run/nginx.pid\nnginx.service: Failed with result exit-code', p: '-rw-r--r--', s: '4.0K' },
      '/etc/nginx/nginx.conf': { c: 'worker_processes auto;\nevents { worker_connections 1024; }', p: '-rw-r--r--', s: '1.1K' }
    };
  }
  fresh();

  function rs(p) {
    p = p.replace(/^~/, '/home/trainee');
    if (p[0] !== '/') p = cwd + '/' + p;
    const out = [];
    p.split('/').forEach(x => { if (x === '..') out.pop(); else if (x && x !== '.') out.push(x); });
    return '/' + out.join('/');
  }
  function isDir(p) { return p === '/' || Object.keys(F).some(k => k.startsWith(p + '/')); }
  function kids(d) {
    const b = d === '/' ? '/' : d + '/';
    return [...new Set(Object.keys(F).filter(k => k.startsWith(b)).map(k => k.slice(b.length).split('/')[0]))].sort();
  }
  function modeStr(m) { return [...m].map(d => [4, 2, 1].map((b, i) => (d & b ? 'rwx'[i] : '-')).join('')).join(''); }

  function run(line) {
    let a = line.trim().split(/\s+/), sudo = false;
    if (a[0] === 'sudo') { sudo = true; a.shift(); }
    const c = a[0] || '', r = a.slice(1), f = r.filter(x => x[0] !== '-'), fl = r.join(' ');

    switch (c) {
      case '': return '';
      case 'help':
        return 'Commands: ls [-l] [dir], cd, pwd, cat, tail, grep, df -h, systemctl status|restart <svc>, rm, chmod, useradd, usermod, id, ./script, sudo, clear';
      case 'whoami': return 'trainee';
      case 'pwd': return cwd;
      case 'ls': {
        const d = f[0] ? rs(f[0]) : cwd;
        if (!isDir(d)) return `ls: cannot access '${f[0]}': No such file or directory`;
        const k = kids(d);
        if (!/-\w*l/.test(fl)) return k.join('  ');
        return k.map(n => {
          const x = F[(d === '/' ? '' : d) + '/' + n];
          return x ? `${x.p} trainee ${x.s.padStart(5)} ${n}` : `drwxr-xr-x trainee  4.0K ${n}`;
        }).join('\n');
      }
      case 'cd': {
        const d = rs(f[0] || '~');
        if (!isDir(d)) return `cd: ${f[0]}: No such file or directory`;
        cwd = d;
        return '';
      }
      case 'cat': case 'tail': {
        const x = F[rs(f[0] || '')];
        return x ? x.c : `${c}: ${f[0] || ''}: No such file or directory`;
      }
      case 'grep': {
        const x = F[rs(f[1] || '')];
        return x ? x.c.split('\n').filter(s => s.includes(f[0])).join('\n') : `grep: ${f[1] || ''}: No such file or directory`;
      }
      case 'df':
        return `Filesystem      Size  Used Avail Use% Mounted on\n/dev/nvme0n1p1   50G   ${Math.round(disk / 2)}G   ${50 - Math.round(disk / 2)}G  ${disk}% /`;
      case 'systemctl': {
        if (f[1] !== 'nginx') return `Unit ${f[1] || ''} could not be found.`;
        if (f[0] === 'status') return '\u25cf nginx.service - nginx web server\n   Active: ' + (nginx ? 'active (running)' : 'failed (Result: exit-code)');
        if (/^(re)?start$/.test(f[0])) {
          if (!sudo) return 'Failed: Interactive authentication required. (hint: use sudo)';
          nginx = true;
          return '';
        }
        return 'Usage: systemctl status|restart nginx';
      }
      case 'rm': {
        const p = rs(f[0] || '');
        if (!F[p]) return `rm: cannot remove '${f[0] || ''}': No such file or directory`;
        if (!sudo && p.startsWith('/var')) return `rm: cannot remove '${f[0]}': Permission denied (hint: sudo)`;
        if (p === '/var/log/app.log') return 'Refused by the sandbox: this is the live log. Delete the rotated app.log.1 instead.';
        delete F[p];
        if (p.endsWith('app.log.1')) disk = 58;
        return '';
      }
      case 'useradd': {
        if (!sudo) return 'useradd: Permission denied. (hint: sudo)';
        if (!f[0]) return 'usage: sudo useradd -m <name>';
        users[f[0]] = [];
        return '';
      }
      case 'usermod': {
        if (!sudo) return 'usermod: Permission denied. (hint: sudo)';
        const [g, n] = f;
        if (!users[n]) return `usermod: user '${n}' does not exist`;
        users[n].push(g);
        return '';
      }
      case 'id': {
        const n = f[0] || 'trainee';
        if (n === 'trainee') return 'uid=1000(trainee) gid=1000(trainee) groups=1000(trainee)';
        if (!users[n]) return `id: '${n}': no such user`;
        return `uid=1001(${n}) gid=1001(${n}) groups=1001(${n})` + users[n].map(g => `,10(${g})`).join('');
      }
      case 'chmod': {
        const x = F[rs(f[1] || '')];
        if (!/^[0-7]{3}$/.test(f[0] || '') || !x) return 'usage: chmod 750 <file>';
        x.p = '-' + modeStr(f[0]);
        return '';
      }
    }
    if (c.startsWith('./')) {
      const x = F[rs(c)];
      if (!x) return `bash: ${c}: No such file or directory`;
      return x.p.includes('x') ? 'Backup complete \u2714 /backup/data.tgz (1.2G)' : `bash: ${c}: Permission denied (hint: chmod)`;
    }
    return `${c}: command not found (type 'help')`;
  }

  return { run, reset: fresh, cwd: () => cwd };
}
