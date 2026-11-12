# Registra (o actualiza) la tarea programada de Windows que mantiene la wiki al día.
# Uso:    powershell -ExecutionPolicy Bypass -File scripts/register-wiki-task.ps1
# Quitar: Unregister-ScheduledTask -TaskName 'Hikari Hub - Sincronizar wiki' -Confirm:$false
#
# La tarea se ejecuta cada 6 horas con tu usuario, solo con la sesión iniciada (así puede usar tus
# credenciales de GitHub). Si el PC estaba apagado a la hora prevista, se ejecuta al encenderlo.

$ErrorActionPreference = 'Stop'
$taskName = 'Hikari Hub - Sincronizar wiki'
$script = Join-Path $PSScriptRoot 'sync-wiki.ps1'

$action = New-ScheduledTaskAction -Execute 'powershell.exe' `
  -Argument "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$script`""
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(10) `
  -RepetitionInterval (New-TimeSpan -Hours 6)
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries -MultipleInstances IgnoreNew `
  -ExecutionTimeLimit (New-TimeSpan -Minutes 30)

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings `
  -Description 'Sincroniza la wiki de Hikari Hub con la wiki online de HikariRO y sube los cambios a GitHub.' `
  -Force | Out-Null

Write-Output "Tarea '$taskName' registrada: cada 6 horas. Registro en $PSScriptRoot\wiki-sync.log"
