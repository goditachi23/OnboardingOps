# OnboardOps

OnboardOps is a training app for practising standard operating procedures (SOPs) in a simulated terminal. An administrator creates SOPs and assigns trainees to tracks. Trainees follow the steps, use the terminal, and receive a score and report.

## Run the app

Install Node.js, open a terminal in this folder, and run:

```sh
npm install
npm start
```

Open `http://localhost:4000` in a browser. The first run creates a sample administrator and trainee:

| Role | Username | Password |
| --- | --- | --- |
| Administrator | `admin` | `admin123` |
| Trainee | `trainee` | `trainee123` |

These are demonstration accounts for a local demonstration.

## How the app is organized

- `public/` contains the pages and browser code. `css/style.css` holds the styles. `js/commands.js` is the terminal command list and short help text. `js/terminal.js` simulates the terminal.
- `routes/` contains the web requests for sign-in, SOPs, progress, administration, and reports.
- `services/scoring.js` checks a submitted command against the current SOP step.
- `db/db.json` stores accounts, SOPs, and attempts as ordinary JSON. `db/database.js` reads and writes that file.
- `config/config.js` holds the port and scoring settings.

The browser sends a command to the server. The server checks the current step, updates the attempt, and saves it to `db/db.json`. The browser displays the score returned by the server; it does not calculate the score itself. The terminal is simulated and does not execute commands on the computer running the app.

## Create an SOP

Sign in as the administrator and open the SOPs tab. Choose a track or add a new one, then add at least one step. Each step needs:

- An instruction for the trainee.
- An expected command pattern. This is a JavaScript regular expression matched against the full command, without regard to letter case. For example, `^ip a$` matches `ip a`.
- A hint command and the number of points available for that step.

The maximum score for an SOP is the sum of its step points. The first hint for a step reduces the points awarded for that step by up to 5, capped at half of that step's value. More requests for the same step do not add another hint deduction. Wrong commands can have small penalties; commands that do not match a known mistake are not penalized.

## Add terminal help

Add a command name and description to `public/js/commands.js`. The terminal uses this list for `help` and `man`. The simulated behavior for commands that the training environment supports is in `public/js/terminal.js`. A listed command may show a reference message if its behavior is not simulated. Commands entered here never run on the host computer.
