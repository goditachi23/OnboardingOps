// A cosmetic, client-side virtual Linux server: a broad set of everyday
// read-only/explore commands plus the handful of stateful ones the SOPs
// need (systemctl, rm, useradd, usermod, chmod, ...), so trainees can poke
// around a realistic box between SOP steps. It never decides whether a step
// is "correct" or scores anything -- that judgment always comes from the
// server (see trainee.js / services/scoring.js), including whether a
// command was dangerous or used sudo when it didn't need to.
function makeSandbox() {
  let cwd, F, nginx, disk, users, hist;

  const MAN = {
    ls: 'list directory contents', cd: 'change the working directory', pwd: 'print working directory',
    cat: 'concatenate and print a file', tail: 'output the last part of a file', head: 'output the first part of a file',
    grep: 'search text for a pattern', find: 'search for files in a directory tree', wc: 'count lines/words/bytes',
    df: 'report filesystem disk space usage', du: 'estimate file/directory space usage',
    systemctl: 'control systemd services', service: 'run a System V init script',
    ps: 'report a snapshot of current processes', top: 'display running processes, updating',
    free: 'display memory usage', uptime: 'show how long the system has been running and its load',
    whoami: 'print the current username', id: 'print user and group IDs', who: 'show who is logged in',
    w: 'show who is logged in and what they are doing', hostname: 'show or set the system hostname',
    uname: 'print system information', date: 'print or set the system date and time',
    history: 'show the command history of this session', which: 'locate a command in PATH',
    env: 'print the environment', man: 'show the manual page for a command',
    netstat: 'show network connections', ss: 'show socket statistics', ip: 'show/manipulate networking',
    ifconfig: 'configure a network interface', ping: 'send ICMP echo requests to a host',
    less: 'view a file one screen at a time', more: 'view a file one screen at a time', file: 'identify file type',
    touch: 'create an empty file or update its timestamp', mkdir: 'create a directory',
    cp: 'copy a file', mv: 'move or rename a file', rm: 'remove a file',
    chmod: 'change file permissions', useradd: 'create a new user account', usermod: 'modify a user account',
    passwd: 'change a user password', su: 'switch user', sudo: 'run a command as another user (usually root)',
    kill: 'send a signal to a process', crontab: 'schedule recurring jobs',
    journalctl: 'query the systemd journal (logs)', clear: 'clear the terminal screen', echo: 'print text',
    help: 'list the commands this sandbox understands'
  };

  function fresh() {
    cwd = '/home/trainee';
    nginx = false;
    disk = 91;
    users = {};
    hist = [];
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
  function glob(pattern, name) { return new RegExp('^' + pattern.replace(/[.]/g, '\\.').replace(/\*/g, '.*') + '$', 'i').test(name); }

  function run(line) {
    const raw = line.trim();
    if (raw && raw !== 'history') hist.push(raw);

    let a = raw.split(/\s+/), sudo = false;
    if (a[0] === 'sudo') { sudo = true; a.shift(); }
    const c = a[0] || '', r = a.slice(1), f = r.filter(x => x[0] !== '-'), fl = r.join(' ');

    switch (c) {
      case '': return '';
      case 'help':
        return 'Try: ls, cd, pwd, cat, head, tail, grep, find, wc, df, du, systemctl, service, ps, top, free, uptime, ' +
          'whoami, id, who, w, hostname, uname, date, history, which, env, man <cmd>, netstat, ss, ip a, ping, ' +
          'less, file, touch, mkdir, cp, mv, rm, chmod, useradd, usermod, passwd, su, kill, crontab, journalctl, sudo, clear';
      case 'man': {
        const name = f[0];
        if (!name) return 'What manual page do you want?';
        return MAN[name] ? `${name.toUpperCase()}(1)\n    ${MAN[name]}` : `No manual entry for ${name}`;
      }
      case 'echo': return r.join(' ');
      case 'whoami': return 'trainee';
      case 'pwd': return cwd;
      case 'hostname': return 'web-01';
      case 'uname': return /-a\b/.test(fl) ? 'Linux web-01 5.14.0-427.el9.x86_64 #1 SMP PREEMPT_DYNAMIC x86_64 GNU/Linux' : 'Linux';
      case 'date': return new Date().toString();
      case 'uptime': return ' 10:32:15 up 14 days,  3:21,  1 user,  load average: 0.08, 0.12, 0.09';
      case 'who': return 'trainee  pts/0   ' + new Date().toTimeString().slice(0, 5) + ' (10.0.0.4)';
      case 'w':
        return ' ' + new Date().toTimeString().slice(0, 8) + ' up 14 days,  3:21,  1 user,  load average: 0.08, 0.12, 0.09\n' +
          'USER     TTY      LOGIN@   IDLE   JCPU   PCPU WHAT\ntrainee  pts/0    ' + new Date().toTimeString().slice(0, 5) + '    0.00s  0.02s  0.00s  -bash';
      case 'env':
        return 'SHELL=/bin/bash\nUSER=trainee\nHOME=/home/trainee\nPATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin\nHOSTNAME=web-01';
      case 'which': {
        const known = new Set(['ls', 'cat', 'df', 'systemctl', 'grep', 'chmod', 'useradd', 'usermod', 'id', 'ps', 'top', 'free', 'ping', 'ip', 'find']);
        if (!f[0]) return '';
        return known.has(f[0]) ? `/usr/bin/${f[0]}` : `which: no ${f[0]} in (/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin)`;
      }
      case 'history': return hist.map((h, i) => `  ${i + 1}  ${h}`).join('\n');

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
      case 'cat': case 'less': case 'more': {
        const x = F[rs(f[0] || '')];
        return x ? x.c : `${c}: ${f[0] || ''}: No such file or directory`;
      }
      case 'tail': case 'head': {
        const x = F[rs(f[0] || '')];
        if (!x) return `${c}: ${f[0] || ''}: No such file or directory`;
        const lines = x.c.split('\n');
        return c === 'tail' ? lines.slice(-5).join('\n') : lines.slice(0, 5).join('\n');
      }
      case 'wc': {
        const x = F[rs(f[0] || '')];
        if (!x) return `wc: ${f[0] || ''}: No such file or directory`;
        const lines = x.c.split('\n');
        return `${lines.length} ${x.c.split(/\s+/).filter(Boolean).length} ${x.c.length} ${f[0]}`;
      }
      case 'grep': {
        const x = F[rs(f[1] || '')];
        return x ? x.c.split('\n').filter(s => s.includes(f[0])).join('\n') : `grep: ${f[1] || ''}: No such file or directory`;
      }
      case 'find': {
        const d = rs(f[0] || cwd);
        const nameIdx = r.indexOf('-name');
        const pattern = nameIdx !== -1 ? r[nameIdx + 1].replace(/['"]/g, '') : '*';
        const b = d === '/' ? '/' : d + '/';
        return Object.keys(F).filter(k => k.startsWith(b) && glob(pattern, k.split('/').pop())).join('\n') || '(no matches)';
      }
      case 'file': {
        const p = rs(f[0] || '');
        if (isDir(p) && !F[p]) return `${f[0]}: directory`;
        return F[p] ? `${f[0]}: ASCII text` : `${f[0] || ''}: cannot open (No such file or directory)`;
      }
      case 'touch': {
        const p = rs(f[0] || '');
        if (!f[0]) return 'usage: touch <file>';
        if (!F[p]) F[p] = { c: '', p: '-rw-r--r--', s: '0' };
        return '';
      }
      case 'mkdir': {
        if (!f[0]) return 'usage: mkdir <dir>';
        F[rs(f[0]) + '/.keep'] = { c: '', p: '-rw-r--r--', s: '0' };
        return '';
      }
      case 'cp': {
        const [src, dst] = f;
        const x = F[rs(src || '')];
        if (!x) return `cp: cannot stat '${src || ''}': No such file or directory`;
        F[rs(dst)] = { ...x };
        return '';
      }
      case 'mv': {
        const [src, dst] = f;
        const p = rs(src || '');
        if (!F[p]) return `mv: cannot stat '${src || ''}': No such file or directory`;
        F[rs(dst)] = F[p];
        delete F[p];
        return '';
      }

      case 'df':
        return `Filesystem      Size  Used Avail Use% Mounted on\n/dev/nvme0n1p1   50G   ${Math.round(disk / 2)}G   ${50 - Math.round(disk / 2)}G  ${disk}% /`;
      case 'du':
        return /var\/log/.test(fl) ? `2.1G\t/var/log` : `4.0K\t${f[0] || '.'}`;
      case 'free':
        return '              total        used        free      shared  buff/cache   available\nMem:        8010892     2216344     1381220      112640     4413328     5432112\nSwap:       2097148           0     2097148';
      case 'ps': {
        const rows = ['  PID TTY          TIME CMD', '  812 ?        00:00:01 systemd', ' 1447 ?        00:00:00 sshd'];
        if (nginx) rows.push(' 2203 ?        00:00:00 nginx: master', ' 2204 ?        00:00:00 nginx: worker');
        rows.push(' 3310 pts/0    00:00:00 bash', ' 3402 pts/0    00:00:00 ps');
        return rows.join('\n');
      }
      case 'top':
        return 'top - ' + new Date().toTimeString().slice(0, 8) + ' up 14 days,  1 user,  load average: 0.08, 0.12, 0.09\n' +
          'Tasks:  98 total,   1 running,  97 sleeping\n%Cpu(s):  2.3 us,  1.1 sy,  0.0 ni, 96.4 id\n' +
          'MiB Mem :   7823.5 total,   1349.2 free,   2164.4 used,   4309.9 buff/cache\n\n' +
          '  PID USER      PR  NI    VIRT    RES  %CPU  %MEM     TIME+ COMMAND\n  812 root      20   0  169984  11288   0.3   0.1   0:01.44 systemd' +
          (nginx ? '\n 2203 root      20   0   55672   4132   0.0   0.1   0:00.02 nginx\n 2204 www-data  20   0   56104   6220   0.1   0.1   0:00.05 nginx' : '') +
          '\n(simulated snapshot -- top would normally refresh continuously)';

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
      case 'service': {
        if (f[0] !== 'nginx') return `${f[0] || ''}: unrecognized service`;
        if (f[1] === 'status') return nginx ? 'nginx is running.' : 'nginx is not running.';
        return `service: ${f[1] || ''}: not simulated, try systemctl instead`;
      }
      case 'journalctl':
        return nginx
          ? '-- nginx.service has started, worker processes online --'
          : 'nginx.service: Main process exited, code=exited, status=1/FAILURE\nnginx.service: Failed with result \'exit-code\'.';

      case 'netstat': case 'ss': {
        const rows = ['Proto Recv-Q Send-Q Local Address           State', 'tcp        0      0 0.0.0.0:22              LISTEN'];
        if (nginx) rows.push('tcp        0      0 0.0.0.0:80              LISTEN');
        return rows.join('\n');
      }
      case 'ip': case 'ifconfig':
        return 'eth0: flags=4163<UP,BROADCAST,RUNNING>  mtu 1500\n        inet 10.0.0.42  netmask 255.255.255.0\n        ether 02:42:0a:00:00:2a';
      case 'ping': {
        const host = f[0] || 'localhost';
        return `PING ${host} 56(84) bytes of data.\n64 bytes from ${host}: icmp_seq=1 ttl=64 time=0.031 ms\n\n--- ${host} ping statistics ---\n1 packets transmitted, 1 received, 0% packet loss`;
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
      case 'passwd': return 'passwd: simulated sandbox -- password changes are disabled here';
      case 'su': return 'su: simulated sandbox -- use sudo for elevated commands instead';
      case 'crontab': return f[0] === '-l' ? 'no crontab for trainee' : 'crontab: simulated sandbox -- editing is disabled here';
      case 'kill': {
        const pid = f[0];
        if (!pid) return 'usage: kill [-9] <pid>';
        if (!sudo) return `kill: (${pid}) - Operation not permitted (hint: sudo)`;
        return `Sent signal to process ${pid}. (simulated -- no real process was running)`;
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
