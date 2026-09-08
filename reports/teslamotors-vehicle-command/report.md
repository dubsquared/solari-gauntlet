# Gauntlet review — https://github.com/teslamotors/vehicle-command.git

**24/30** · reviewed 2026-09-08 at `f97fa1e` · ran as `cli` · 117s · ~61k tokens

> ⚠️ **Flagged for manual review:** runs=9 despite 2 failed step(s). Treat the scores below with suspicion.

| Dimension | Score | |
| --- | --- | --- |
| Runs | 9/10 | `█████████░` |
| Delivers its claims | 8/10 | `████████░░` |
| Code quality | 7/10 | `███████░░░` |

Technically, the submission builds, its test suite passes cleanly across nearly a dozen packages, and the CLI's live output matches the documented command list, which is good verifiable evidence of a working, decently structured codebase. However, the tree and content are essentially identical to Tesla's actual open-source vehicle-command repository, with no visible sign of original candidate work — this is a serious authenticity red flag for a hiring submission that must be addressed before crediting design or implementation decisions to the candidate. Scores here reflect only the observable run/test/quality evidence, not authorship.

## Strengths
- Repo builds cleanly with `go build ./...` and the CLI actually runs, producing help output that matches the documented command set in the README
- Test suite passes across essentially all packages (dispatcher, schnorr, account, cache, cli, connector/inet, protocol, proxy, vehicle) with no failures observed
- Code is organized into clear internal/ (crypto, session, dispatcher) and pkg/ (protocol, vehicle, proxy, cli) boundaries with dedicated test files per package, suggesting deliberate architecture rather than a monolithic script
- Sentinel errors (ErrCommandLineArgs, ErrInvalidTime) and explicit error propagation are used in the CLI command layer rather than panics or silent failures

## Concerns
- CRITICAL: the file tree, go.mod, README, and source excerpts are an essentially exact match for the public teslamotors/vehicle-command GitHub repository (down to file names like internal/schnorr, doc/authorization.puml, and the Makefile). There is no visible diff, added feature, or candidate-authored module distinguishing this from a plain clone of the official upstream project — this must be verified as the candidate's own contribution before any credit is given
- The 'live probe' only exercises `-h`/usage output; no actual vehicle command, BLE, or HTTP-proxy interaction was demonstrated, so the deeper protocol/authentication claims in the README (E2E command auth, BLE pairing, REST proxy behavior) remain unverified against real behavior
- Initial run required substantial environment repair (missing Go toolchain, GOPATH/GOMODCACHE unset) — friction was in tooling setup rather than the code itself, but it means the environment was not 'ready to run' out of the box
- Code excerpts provided are shallow (mostly CLI arg-parsing and boilerplate wrappers); the core cryptographic/session logic (internal/authentication, internal/schnorr) that would best demonstrate engineering skill was not shown for direct quality assessment

## How it was run
> Each setup line runs in a fresh shell so exported env vars (GOPATH/GOMODCACHE/HOME) were lost; now explicitly set them (and HOME, since root's HOME may be unset in non-interactive shell) in every command that invokes go. No credentials/hardware available, so we just build and show CLI help as smoke test.

```console
$ cd /home/user/repo && curl -fsSL -o /tmp/go.tar.gz https://go.dev/dl/go1.23.0.linux-amd64.tar.gz   # exit 0
$ cd /home/user/repo && rm -rf /usr/local/go && tar -C /usr/local -xzf /tmp/go.tar.gz   # exit 0
$ cd /home/user/repo && export PATH=$PATH:/usr/local/go/bin   # exit 0
$ cd /home/user/repo && go version   # exit 127
$ cd /home/user/repo && curl -fsSL -o /tmp/go.tar.gz https://go.dev/dl/go1.23.0.linux-amd64.tar.gz && rm -rf /usr/local/go && tar -C /usr/local -xzf /tmp/go.tar.gz   # exit 0
$ cd /home/user/repo && ln -sf /usr/local/go/bin/go /usr/local/bin/go && ln -sf /usr/local/go/bin/gofmt /usr/local/bin/gofmt   # exit 0
$ cd /home/user/repo && go version   # exit 0
$ cd /home/user/repo && go mod download   # exit 1
$ cd /home/user/repo && curl -fsSL -o /tmp/go.tar.gz https://go.dev/dl/go1.23.0.linux-amd64.tar.gz && rm -rf /usr/local/go && tar -C /usr/local -xzf /tmp/go.tar.gz   # exit 0
$ cd /home/user/repo && mkdir -p /root/go/pkg/mod /root/.cache/go-build   # exit 0
$ cd /home/user/repo && echo 'export PATH=$PATH:/usr/local/go/bin' >> /etc/profile.d/go.sh   # exit 0
$ cd /home/user/repo && echo 'export GOPATH=/root/go' >> /etc/profile.d/go.sh   # exit 0
$ cd /home/user/repo && echo 'export GOCACHE=/root/.cache/go-build' >> /etc/profile.d/go.sh   # exit 0
$ cd /home/user/repo && echo 'export GOMODCACHE=/root/go/pkg/mod' >> /etc/profile.d/go.sh   # exit 0
$ cd /home/user/repo && export PATH=$PATH:/usr/local/go/bin GOPATH=/root/go GOCACHE=/root/.cache/go-build GOMODCACHE=/root/go/pkg/mod HOME=/root && go version   # exit 0
$ cd /home/user/repo && export PATH=$PATH:/usr/local/go/bin GOPATH=/root/go GOCACHE=/root/.cache/go-build GOMODCACHE=/root/go/pkg/mod HOME=/root && go mod download   # exit 0
$ cd /home/user/repo && export PATH=$PATH:/usr/local/go/bin GOPATH=/root/go GOCACHE=/root/.cache/go-build GOMODCACHE=/root/go/pkg/mod HOME=/root && go build ./...   # exit 0
$ cd /home/user/repo && export PATH=$PATH:/usr/local/go/bin GOPATH=/root/go GOCACHE=/root/.cache/go-build GOMODCACHE=/root/go/pkg/mod HOME=/root && go run ./cmd/tesla-control -h   # exit 0
```

## The submission's own tests
`export PATH=$PATH:/usr/local/go/bin GOPATH=/root/go GOCACHE=/root/.cache/go-build GOMODCACHE=/root/go/pkg/mod HOME=/root && go test ./... || true` → **PASS**

```
ors/vehicle-command/internal/schnorr	0.000s
ok  	github.com/teslamotors/vehicle-command/pkg/account	0.003s
ok  	github.com/teslamotors/vehicle-command/pkg/cache	0.003s
ok  	github.com/teslamotors/vehicle-command/pkg/cli	0.003s
ok  	github.com/teslamotors/vehicle-command/pkg/connector/inet	0.007s
?   	github.com/teslamotors/vehicle-command/pkg/protocol/protobuf/carserver	[no test files]
?   	github.com/teslamotors/vehicle-command/pkg/protocol/protobuf/errors	[no test files]
?   	github.com/teslamotors/vehicle-command/pkg/protocol/protobuf/keys	[no test files]
?   	github.com/teslamotors/vehicle-command/pkg/protocol/protobuf/managedcharging	[no test files]
?   	github.com/teslamotors/vehicle-command/pkg/protocol/protobuf/signatures	[no test files]
?   	github.com/teslamotors/vehicle-command/pkg/protocol/protobuf/universalmessage	[no test files]
?   	github.com/teslamotors/vehicle-command/pkg/protocol/protobuf/vcsec	[no test files]
ok  	github.com/teslamotors/vehicle-command/pkg/protocol	0.010s
?   	github.com/teslamotors/vehicle-command/pkg/sign	[no test files]
ok  	github.com/teslamotors/vehicle-command/pkg/proxy	5.959s
ok  	github.com/teslamotors/vehicle-command/pkg/vehicle	0.082s

```

## Security sweep
- dependency audit: n/a (no lockfile)
- secret patterns: ⚠️ matches in `./internal/authentication/native_test.go`, `./internal/authentication/test_data/valid_rsa_private_key.pem`, `./internal/authentication/test_data/not_pkcs8.pem`, `./pkg/protocol/protocol.md`, `./pkg/protocol/test/private.pem`, `./pkg/protocol/test/p521.pem`, `./pkg/protocol/test/private-invalid.pem`

## Output
```
Usage: /tmp/go-build152641516/b001/exe/tesla-control [OPTION...] COMMAND [ARG...]

Run /tmp/go-build152641516/b001/exe/tesla-control help COMMAND for more information. Valid COMMANDs are listed below.

 * Commands sent to a vehicle over the internet require a VIN and a token.
 * Commands sent to a vehicle over BLE require a VIN.
 * Account-management commands require a token.

Available OPTIONs:

Available COMMANDs:
  add-key                           Add PUBLIC_KEY to vehicle whitelist with ROLE and FORM_FACTOR
  add-key-request                   Request NFC-card approval for an enrolling PUBLIC_KEY with ROLE and FORM_FACTOR
  auto-seat-and-climate             Turn on automatic seat heating and HVAC
  autosecure-modelx                 Close falcon-wing doors and lock vehicle. Model X only.
  body-controller-state             Fetch limited vehicle state information. Works over BLE when infotainment is asleep.
  charge-port-close                 Close charge port
  charge-port-open                  Open charge port
  charging-schedule                 Schedule charging to MINS minutes after midnight and enable daily scheduling
  charging-schedule-add             Schedule charge for DAYS START_TIME-END_TIME at LATITUDE LONGITUDE. The END_TIME may be on the following day.
  charging-schedule-cancel          Cancel scheduled charge start
  charging-schedule-remove          Removes charging schedule of TYPE [ID]
  charging-set-amps                 Set charge current to AMPS
  charging-set-limit                Set charge limit to PERCENT
  charging-start                    Start charging
  charging-stop                     Stop charging
  climate-off                       Turn off climate control
  climate-on                        Turn on climate control
  climate-set-temp                  Set temperature (Celsius)
  drive                             Remote start vehicle
  erase-guest-data                  Erase Guest Mode user data
  flash-lights                      Flash lights
  frunk-open                        Open vehicle frunk. Note that there's no frunk-close command!
  get                               GET an owner API http ENDPOINT. Hostname will be taken from -config.
  guest-mode-off                    Disable Guest Mode.
  guest-mode-on                     Enable Guest Mode. See https://developer.tesla.com/docs/fleet-api/endpoints/vehicle-commands#guest-mode.
  honk                              Honk horn
  keep-accessory-power              Set keep accessory power mode to STATE ('on' or 'off')
  list-keys                         List public keys enrolled on vehicle
  lock                              Lock vehicle
  low-power-mode                    Set low power mode to STATE ('on' or 'off')
  media-next-favorite               Next favorite
  media-next-track                  Next track
  media-previous-favorite           Previous favorite
  media-previous-track              Previous track
  media-set-volume                  Set volume
  media-toggle-playback             Toggle between play/pause
  media-volume-down                 Decrease volume
  media-volume-up                   Increase volume
  parental-controls-clear-pin-admin Clear the stored parental controls PIN
  parental-controls-enable-setting  Enable or disable a parental controls setting. Fails if parental controls are already active.
  parental-controls-off             Deactivate parental controls
  parental-controls-on              Activate parental controls. The command will fail if parental controls are already set with a different PIN.
  parental-controls-set-speed-limit Set parental controls speed limit in MPH. Fails if parental controls are already active.
  ping                              Ping vehicle
  post                              POST to ENDPOINT the contents of FILE. Hostname will be taken from -config.
  precondition-schedule-add         Schedule precondition for DAYS TIME at LATITUDE LONGITUDE.
  precondition-schedule-remove      Removes precondition schedule of TYPE [ID]
  product-info                      Print JSON product info
  remove-key                        Remove PUBLIC_KEY from vehicle whitelist
  rename-key                        Change the human-readable name of PUBLIC_KEY to NAME
  seat-heater                       Set seat heater at SEAT to LEVEL
  sentry-mode                       Set sentry mode to STATE ('on' or 'off')
  session-info                      Retrieve session info for PUBLIC_KEY from DOMAIN
  software-update-cancel            Cancel a pending software update
  software-update-start             Start software update after DELAY
  state                             Fetch vehicle state over BLE.
  steering-wheel-heater             Set steering wheel mode to STATE ('on' or 'off')
  tonneau-close                     Close Cybertruck tonneau.
  tonneau-open                      Open Cybertruck tonneau.
  tonneau-stop                      Stop moving Cybertruck tonneau.
  trunk-close          
```

## Ask the candidate
1. Walk me through the session handshake in internal/authentication/dispatcher.go and ecdh.go — why is a Diffie-Hellman handshake needed before commands can be signed, and what attack does it prevent?
2. The Makefile runs `go vet` and golangci-lint separately from `go test` — what specific lint rules or vet checks did you have to work around, and why?
3. In cmd/tesla-control/commands.go, commands are dispatched through a Handler map keyed by domain/name — what would you change if you needed to add a new command that requires both BLE and Fleet API paths, and where would that logic actually live?

---
Evidence sealed: [`manifest.json`](manifest.json) carries a SHA-256 for every
artifact in this directory, ed25519-signed. `npm run verify -- <this dir>`
proves nothing changed since the review.
