
  # =========================================
  # PowerShell Profile - Deluxe Safe Edition
  # =========================================

  $ErrorActionPreference = 'Continue'

  # -------------------------
  # Core helpers
  # -------------------------

  function Test-CommandExists {
    param(
      [Parameter(Mandatory = $true)]
      [string]$Name
    )

    return [bool](Get-Command $Name -ErrorAction SilentlyContinue)
  }

  function Test-InteractiveShell {
    try {
      if (-not $Host.UI) { return $false }
      if ([Console]::IsInputRedirected) { return $false }
      if ([Console]::IsOutputRedirected) { return $false }
      if ([Console]::IsErrorRedirected) { return $false }
      return $true
    }
    catch {
      return $false
    }
  }

  function Test-TerminalSupportsVT {
    try {
      if (-not (Test-InteractiveShell)) { return $false }
      if ($env:WT_SESSION) { return $true }
      if ($env:TERM_PROGRAM -eq 'vscode') { return $true }
      if ($env:TERM) { return $true }
      return $false
    }
    catch {
      return $false
    }
  }

  function Invoke-Safely {
    param(
      [Parameter(Mandatory = $true)]
      [scriptblock]$Script
    )

    try {
      & $Script
    }
    catch {
      # keep non-interactive and restricted environments quiet
    }
  }

  function Set-DefaultEditor {
    if (Test-CommandExists 'micro') {
      $env:EDITOR = 'micro'
      return
    }

    if (Test-CommandExists 'code') {
      $env:EDITOR = 'code --wait'
      return
    }

    if (Test-CommandExists 'nvim') {
      $env:EDITOR = 'nvim'
      return
    }

    if (Test-CommandExists 'vim') {
      $env:EDITOR = 'vim'
      return
    }

    $env:EDITOR = 'notepad'
  }

  $IsInteractiveShell = Test-InteractiveShell
  $SupportsVT = Test-TerminalSupportsVT

  # -------------------------
  # Shared environment
  # -------------------------

  Set-DefaultEditor

  $env:FZF_DEFAULT_COMMAND = 'rg --files --hidden -g "!.git" -g "!node_modules"'
  $env:FZF_CTRL_T_OPTS = "--preview 'bat --color=always --style=numbers --line-range=:300 {}'"
  $env:RIPGREP_CONFIG_PATH = "$HOME\.ripgreprc"

  # -------------------------
  # Always-safe utility funcs
  # -------------------------

  function touch {
    param([Parameter(Mandatory = $true, ValueFromRemainingArguments = $true)][string[]]$Path)
    foreach ($item in $Path) {
      if (Test-Path $item) {
        (Get-Item $item).LastWriteTime = Get-Date
      }
      else {
        New-Item -ItemType File -Path $item | Out-Null
      }
    }
  }

  function mkcd {
    param([Parameter(Mandatory = $true)][string]$Path)
    New-Item -ItemType Directory -Force -Path $Path | Out-Null
    Set-Location $Path
  }

  function which {
    param([Parameter(Mandatory = $true)][string]$Name)
    Get-Command $Name -ErrorAction SilentlyContinue
  }

  function reload-profile {
    . $PROFILE
  }

  function profile-path {
    $PROFILE
  }

  function edit-profile {
    if (Test-CommandExists 'micro') {
      micro $PROFILE
      return
    }

    if (Test-CommandExists 'code') {
      code --wait $PROFILE
      return
    }

    notepad $PROFILE
  }

  function c { Clear-Host }

  # -------------------------
  # Interactive enhancements
  # -------------------------

  if ($IsInteractiveShell) {
    # PSReadLine
    if (Test-CommandExists 'Set-PSReadLineOption') {
      Invoke-Safely {
        if ($SupportsVT) {
          Set-PSReadLineOption -PredictionSource History
          Set-PSReadLineOption -PredictionViewStyle InlineView
        }

        Set-PSReadLineKeyHandler -Key Ctrl+a -Function BeginningOfLine
        Set-PSReadLineKeyHandler -Key Ctrl+e -Function EndOfLine
        Set-PSReadLineKeyHandler -Key Ctrl+d -Function DeleteChar
        Set-PSReadLineKeyHandler -Key Ctrl+f -Function ForwardChar
        Set-PSReadLineKeyHandler -Key Ctrl+b -Function BackwardChar
      }
    }

    # zoxide
    if (Test-CommandExists 'zoxide') {
      Invoke-Safely {
        Invoke-Expression (& { (zoxide init powershell | Out-String) })
      }
    }

    # eza / ls family
    Remove-Item Alias:ls -Force -ErrorAction SilentlyContinue

    if (Test-CommandExists 'eza') {
      function ls { eza --icons @args }
      function ll { eza -l --icons --git @args }
      function la { eza -la --icons --git @args }
      function lt { eza -T -L 3 --icons --git-ignore @args }
      function lta { eza -T --icons --git-ignore @args }
    }
    else {
      function ls { Get-ChildItem @args }
      function ll { Get-ChildItem -Force @args }
      function la { Get-ChildItem -Force @args }
      function lt { Get-ChildItem @args }
      function lta { Get-ChildItem -Force @args }
    }

    # bat / cat
    if (Test-CommandExists 'bat') {
      Set-Alias cat bat -Option AllScope
    }
    else {
      function cat { Get-Content @args }
    }

    # broot
    $BrootLauncher = 'C:\Users\T590\AppData\Roaming\dystroy\broot\config\launcher\powershell\br.ps1'
    if (Test-Path $BrootLauncher) {
      Invoke-Safely {
        . $BrootLauncher
      }
    }

    # PSFzf
    if (Get-Module -ListAvailable -Name PSFzf) {
      Invoke-Safely {
        Import-Module PSFzf -ErrorAction Stop
        Set-PsFzfOption -PSReadlineChordProvider 'Ctrl+t' -PSReadlineChordReverseHistory 'Ctrl+r' -PSReadlineChordReverseHistoryCancel 'Escape'
      }
    }

    # starship
    if (Test-CommandExists 'starship') {
      Invoke-Safely {
        Invoke-Expression (&starship init powershell)
      }
    }

    # -------------------------
    # Search / navigation
    # -------------------------

    function grep {
      if (Test-CommandExists 'rg') {
        rg @args
      }
      else {
        Write-Host 'rg not found'
      }
    }

    function ff {
      param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Args)

      if (Test-CommandExists 'fd') {
        fd @Args
        return
      }

      if (Test-CommandExists 'rg') {
        rg --files @Args
        return
      }

      Get-ChildItem -Recurse -File
    }

    function fcd {
      if (-not (Test-CommandExists 'fzf')) { return }
      if (-not (Test-CommandExists 'fd')) { return }

      $dir = fd --type d --hidden --exclude .git --exclude node_modules | fzf
      if ($dir) { Set-Location $dir }
    }

    function fe {
      if (-not (Test-CommandExists 'fzf')) { return }

      $file = $null

      if (Test-CommandExists 'fd') {
        $file = fd --type f --hidden --exclude .git --exclude node_modules | fzf
      }
      elseif (Test-CommandExists 'rg') {
        $file = rg --files --hidden -g "!.git" -g "!node_modules" | fzf
      }

      if (-not $file) { return }

      if (Test-CommandExists 'micro') {
        micro $file
        return
      }

      if (Test-CommandExists 'code') {
        code --wait $file
        return
      }

      notepad $file
    }

    function fh {
      if (-not (Test-CommandExists 'fzf')) { return }
      $cmd = Get-History | Sort-Object Id -Descending | ForEach-Object { $_.CommandLine } | fzf
      if ($cmd) { Invoke-Expression $cmd }
    }

    # -------------------------
    # Git shortcuts
    # -------------------------

    function gs { git status @args }
    function ga { git add @args }
    function gaa { git add . }
    function gb { git branch @args }
    function gba { git branch -a @args }
    function gcmsg {
      param([Parameter(Mandatory = $true)][string]$Message)
      git commit -m $Message
    }
    function gca {
      param([Parameter(Mandatory = $true)][string]$Message)
      git commit -am $Message
    }
    function gco { git checkout @args }
    function gcb {
      param([Parameter(Mandatory = $true)][string]$Branch)
      git checkout -b $Branch
    }
    function gl { git pull @args }
    function gp { git push @args }
    function gpf { git push --force-with-lease @args }
    function gd { git diff @args }
    function gds { git diff --staged @args }
    function glog { git log --oneline --graph --decorate -20 @args }
    function glast { git log -1 --stat }
    function gundo { git restore --staged @args }
    function gclean-merged {
      git branch --merged | Where-Object { $_ -notmatch '^\*' -and $_ -notmatch 'main|master|develop|dev' } | ForEach-Object { $_.Trim() }
    }

    # -------------------------
    # pnpm / node shortcuts
    # -------------------------

    function p { pnpm @args }
    function pi { pnpm install }
    function pd { pnpm dev @args }
    function pb { pnpm build @args }
    function pt { pnpm test @args }
    function plint { pnpm lint @args }
    function ptype { pnpm typecheck @args }
    function pwhy { pnpm why @args }
    function pclean {
      if (Test-Path node_modules) { Remove-Item node_modules -Recurse -Force }
      if (Test-Path pnpm-lock.yaml) { Remove-Item pnpm-lock.yaml -Force }
    }

    # -------------------------
    # Docker shortcuts
    # -------------------------

    function d { docker @args }
    function dps { docker ps @args }
    function dpa { docker ps -a @args }
    function dimg { docker images @args }
    function dlog { docker logs -f @args }
    function dexec { docker exec -it @args }
    function dstopall {
      $ids = docker ps -q
      if ($ids) { docker stop $ids }
    }
    function dmall {
      $ids = docker ps -aq
      if ($ids) { docker rm $ids }
    }
    function dprune { docker system prune @args }

    # -------------------------
    # Archive / utility helpers
    # -------------------------

    function unzip-here {
      param([Parameter(Mandatory = $true)][string]$File)
      Expand-Archive -Path $File -DestinationPath .
    }

    function pjson {
      param([Parameter(Mandatory = $true)][string]$Path)
      Get-Content $Path | ConvertFrom-Json | ConvertTo-Json -Depth 100
    }

    function path {
      $env:Path -split ';'
    }

    function now {
      Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
    }
  }
