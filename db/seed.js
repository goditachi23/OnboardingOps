const bcrypt = require('bcryptjs');
const { v4: uuid } = require('uuid');
const { load, save } = require('./database');

module.exports = function seed() {
  const db = { users: [], sops: [], attempts: [] };

  const admin = {
    id: uuid(), username: 'admin', passwordHash: bcrypt.hashSync('admin123', 10),
    role: 'admin', tracks: [], createdAt: new Date().toISOString()
  };
  const demoTrainee = {
    id: uuid(), username: 'trainee', passwordHash: bcrypt.hashSync('trainee123', 10),
    role: 'trainee', tracks: ['linux'], createdAt: new Date().toISOString()
  };
  db.users.push(admin, demoTrainee);

  const mk = (title, tag, why, timeEstimate, steps) => ({
    id: uuid(), title, track: 'linux', tag, why, timeEstimate,
    createdBy: admin.id, createdAt: new Date().toISOString(),
    steps: steps.map(s => ({ id: uuid(), distractors: [], ...s }))
  });

  db.sops.push(
    mk('Restore a failed web service', 'Incident',
      'The website is down. Follow this before escalating to L3.', '5 min', [
        {
          instruction: 'Check the service status',
          expectedPattern: '^systemctl status nginx$', hintCommand: 'systemctl status nginx', points: 20,
          distractors: [{ pattern: '^systemctl status (httpd|apache2)$',
            explanation: "This organization's web SOP uses nginx, not httpd/apache2 -- check nginx's status instead." }]
        },
        {
          instruction: 'Read the error log to find the cause',
          expectedPattern: '^(tail|cat) /var/log/nginx/error\\.log$', hintCommand: 'tail /var/log/nginx/error.log', points: 20,
          distractors: [{ pattern: '^(tail|cat) /var/log/app\\.log$',
            explanation: 'app.log is the application log. nginx writes its own errors to /var/log/nginx/error.log -- check there instead.' }]
        },
        {
          instruction: 'Restart the service (this needs elevated privileges)',
          expectedPattern: '^sudo systemctl (restart|start) nginx$', hintCommand: 'sudo systemctl restart nginx', points: 20,
          distractors: [
            { pattern: '^sudo (reboot|shutdown)',
              explanation: 'Rebooting restarts every service on the box and causes much longer downtime. Restart only the failed service.' },
            { pattern: '^systemctl restart nginx$',
              explanation: 'Restarting a system service needs elevated privileges -- prefix the command with sudo.' }
          ]
        },
        { instruction: 'Verify it is running', expectedPattern: '^systemctl status nginx$', hintCommand: 'systemctl status nginx', points: 20 }
      ]),
    mk('Free up disk space', 'Maintenance',
      'Disk usage crossed 91% and triggered a P2 alert. Free space without touching live logs.', '5 min', [
        { instruction: 'Check disk usage', expectedPattern: '^df( -h)?$', hintCommand: 'df -h', points: 20 },
        {
          instruction: 'Find the large files in /var/log',
          expectedPattern: '^ls -\\w*l\\w* /var/log/?$', hintCommand: 'ls -lh /var/log', points: 20,
          distractors: [{ pattern: '^ls -\\w*l\\w* /var/www/?$',
            explanation: 'The alert was about /var/log filling up, not the web root -- look in /var/log instead.' }]
        },
        {
          instruction: 'Delete the old rotated log only, never the live one',
          expectedPattern: '^sudo rm /var/log/app\\.log\\.1$', hintCommand: 'sudo rm /var/log/app.log.1', points: 20,
          distractors: [
            { pattern: '^sudo rm /var/log/app\\.log$',
              explanation: 'app.log is the file the application is actively writing to right now -- deleting it can crash the app or lose data. Only app.log.1, the rotated copy, is safe to remove.' },
            { pattern: '^sudo rm -rf /var/log/?\\*?$',
              explanation: 'This wipes every log on the server, including ones you may need later for troubleshooting. Remove only the one rotated file named in the SOP.' }
          ]
        },
        { instruction: 'Confirm space was freed', expectedPattern: '^df( -h)?$', hintCommand: 'df -h', points: 20 }
      ]),
    mk('Create an account for a new joiner', 'Access',
      "Every joiner needs a home directory and the correct access group, set up the approved way.", '3 min', [
        {
          instruction: 'Create the user with a home directory',
          expectedPattern: '^sudo useradd -m alice$', hintCommand: 'sudo useradd -m alice', points: 25,
          distractors: [{ pattern: '^sudo adduser alice$',
            explanation: "adduser isn't available on every distribution this team supports. The SOP standardizes on useradd -m so it works everywhere." }]
        },
        {
          instruction: 'Add the user to the correct access group',
          expectedPattern: '^sudo usermod -aG wheel alice$', hintCommand: 'sudo usermod -aG wheel alice', points: 25,
          distractors: [{ pattern: '^sudo usermod -aG (root|sudo) alice$',
            explanation: 'We use the wheel group for admin access on our RHEL-based systems. Adding a user straight into root is a serious privilege-escalation risk.' }]
        },
        { instruction: 'Verify the account and its groups', expectedPattern: '^id alice$', hintCommand: 'id alice', points: 20 }
      ]),
    mk('Make a script executable', 'Basics',
      'Scripts arrive without execute permission. Apply least privilege, never 777.', '3 min', [
        { instruction: 'List files with their permissions', expectedPattern: '^ls -\\w*l', hintCommand: 'ls -l', points: 15 },
        {
          instruction: 'Set the least-privilege permissions the SOP calls for',
          expectedPattern: '^chmod 750 backup\\.sh$', hintCommand: 'chmod 750 backup.sh', points: 25,
          distractors: [{ pattern: '^chmod 777 backup\\.sh$',
            explanation: '777 makes the file writable and executable by every user on the system -- a common and serious misconfiguration. 750 gives the owner full access and the group read/execute, which is all this script needs.' }]
        },
        { instruction: 'Run the script', expectedPattern: '^\\./backup\\.sh$', hintCommand: './backup.sh', points: 20 }
      ])
  );

  save(db);
  return db;
};

if (require.main === module) {
  module.exports();
  console.log('Database seeded: admin/admin123 (admin), trainee/trainee123 (trainee, track: linux).');
}
