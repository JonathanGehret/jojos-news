#!/usr/bin/env pwsh
# Phase 4 Testing Script for Windows PowerShell

$ErrorActionPreference = "Continue"

Write-Host "════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "PHASE 4: EMAIL DELIVERY TESTING SUITE" -ForegroundColor Cyan -BackgroundColor Black
Write-Host "════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir
$BackendDir = Join-Path $ProjectRoot "backend"

# Colors
$Green = [System.ConsoleColor]::Green
$Red = [System.ConsoleColor]::Red
$Yellow = [System.ConsoleColor]::Yellow
$Cyan = [System.ConsoleColor]::Cyan

Write-Host "📋 Pre-Flight Checklist:" -ForegroundColor Yellow
Write-Host ""

# 1. Check if Docker is running
Write-Host "Checking Docker..." -ForegroundColor Gray
$dockerCheck = docker-compose ps 2>&1 | Select-String "postgres"
if ($dockerCheck) {
    Write-Host "✓ Docker containers are running" -ForegroundColor Green
} else {
    Write-Host "✗ Docker containers not running. Starting..." -ForegroundColor Yellow
    Write-Host "  Run: docker-compose up -d" -ForegroundColor Gray
}

Write-Host ""

# 2. Check if backend is running
Write-Host "Checking backend server..." -ForegroundColor Gray
try {
    $healthCheck = curl.exe -s http://localhost:3001/health
    if ($healthCheck) {
        Write-Host "✓ Backend server is running" -ForegroundColor Green
    } else {
        Write-Host "✗ Backend not ready" -ForegroundColor Yellow
    }
} catch {
    Write-Host "✗ Backend not responding. Make sure to run: npm run dev (in backend dir)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "Starting Phase 4 Validator..." -ForegroundColor Cyan
Write-Host "════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

# Run the validator
Push-Location $BackendDir
try {
    # Build and run TypeScript directly via ts-node or compile first
    if (Test-Path "node_modules\.bin\ts-node") {
        & "node_modules\.bin\ts-node" "../scripts/phase4-validator.ts"
    } else {
        Write-Host "Installing dependencies..." -ForegroundColor Gray
        npm install --silent
        & "node_modules\.bin\ts-node" "../scripts/phase4-validator.ts"
    }
} catch {
    Write-Host "Error running validator: $_" -ForegroundColor Red
} finally {
    Pop-Location
}

Write-Host ""
Write-Host "════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "Phase 4 Testing Complete!" -ForegroundColor Green
Write-Host "════════════════════════════════════════════════════════════" -ForegroundColor Cyan
