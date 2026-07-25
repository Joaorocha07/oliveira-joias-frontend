# Hook: notifica no WhatsApp quando Claude Code finaliza uma resposta
param()

$PHONE  = "553499428253"
$APIKEY = "4526329"

# --- Lê stdin ---
$raw = $input | Out-String
$transcript_path = $null
$cwd_hint = $null
try {
    $data = $raw | ConvertFrom-Json
    $transcript_path = $data.transcript_path
    $cwd_hint = $data.cwd
} catch {}

# --- Horário local ---
$hora = Get-Date -Format "HH:mm"
$data_fmt = Get-Date -Format "dd/MM/yyyy"

# --- Nome do projeto ---
$projeto = ""
if ($cwd_hint) {
    $projeto = Split-Path $cwd_hint -Leaf
} elseif ($transcript_path) {
    # extrai do caminho: ...projects\D--projetos-NOME\...
    if ($transcript_path -match "projects\\(.+?)\\[^\\]+$") {
        $slug = $Matches[1]
        # converte D--projetos-oliveira-joias-frontend -> oliveira-joias-frontend
        $projeto = ($slug -replace '^[A-Za-z]--projetos?-', '') -replace '--', '-'
    }
}

# --- Extrai último texto do assistente ---
$resumo = ""
if ($transcript_path -and (Test-Path $transcript_path)) {
    try {
        $lines = [System.IO.File]::ReadAllLines($transcript_path)
        for ($i = $lines.Count - 1; $i -ge 0; $i--) {
            try {
                $entry = $lines[$i] | ConvertFrom-Json
                if ($entry.role -ne "assistant") { continue }

                $content = $entry.content
                $textos = @()
                if ($content -is [array]) {
                    $textos = $content | Where-Object { $_.type -eq "text" } | ForEach-Object { $_.text }
                } elseif ($content -is [string]) {
                    $textos = @($content)
                }

                $texto_completo = ($textos -join " ").Trim()
                if (-not $texto_completo) { continue }

                # Pega o primeiro parágrafo real (antes de linha em branco ou bloco de código)
                $linhas_texto = $texto_completo -split "`n"
                $para = @()
                foreach ($l in $linhas_texto) {
                    $l_trim = $l.Trim()
                    if ($l_trim -eq "" -or $l_trim.StartsWith("```") -or $l_trim.StartsWith("|") -or $l_trim.StartsWith("#")) {
                        if ($para.Count -gt 0) { break }
                        continue
                    }
                    $para += $l_trim
                }
                $resumo = ($para -join " ").Trim()

                # Se o parágrafo ficou muito curto, pega mais texto
                if ($resumo.Length -lt 60 -and $texto_completo.Length -gt $resumo.Length) {
                    $resumo = $texto_completo -replace "`n+", " "
                    $resumo = $resumo.Trim()
                }

                if ($resumo) { break }
            } catch {}
        }
    } catch {}
}

# Limita tamanho
if ($resumo.Length -gt 400) {
    $resumo = $resumo.Substring(0, 400).TrimEnd() + "..."
}

# --- Monta mensagem ---
$linhas = @()
$linhas += "Claude Code finalizou uma tarefa"
$linhas += ""
$linhas += "Data:    $data_fmt as $hora"
if ($projeto) {
    $linhas += "Projeto: $projeto"
}
$linhas += ""
if ($resumo) {
    $linhas += "Resumo:"
    $linhas += $resumo
} else {
    $linhas += "Tarefa concluida com sucesso."
}

$body = $linhas -join "`n"

# --- Envia ---
$encoded = [System.Uri]::EscapeDataString($body)
$url = "https://api.callmebot.com/whatsapp.php?phone=$PHONE&text=$encoded&apikey=$APIKEY"
try {
    Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 10 -ErrorAction Stop | Out-Null
} catch {}
