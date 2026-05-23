"""Verify deployment health on ECS."""
import json
import os
import paramiko
import sys

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

HOST = os.environ.get('ECS_HOST', '8.146.231.216')
USER = os.environ.get('ECS_USER', 'root')
PASSWORD = os.environ.get('ECS_PASSWORD', '')

if not PASSWORD:
    print("ERROR: ECS_PASSWORD environment variable is required.")
    print("Usage: ECS_PASSWORD=xxx python scripts/verify_deploy.py")
    sys.exit(1)

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(HOST, username=USER, password=PASSWORD)

print("=== 1. Running containers ===")
stdin, stdout, stderr = ssh.exec_command('docker ps --format "{{.Names}} {{.Status}}" | grep labelhub', timeout=10)
stdout.channel.recv_exit_status()
print(stdout.read().decode('utf-8', errors='replace'))

print("=== 2. API health ===")
stdin, stdout, stderr = ssh.exec_command('curl -s http://localhost:8080/api/tasks/health', timeout=10)
stdout.channel.recv_exit_status()
print(stdout.read().decode('utf-8', errors='replace'))

print("\n=== 3. DeepSeek service health ===")
stdin, stdout, stderr = ssh.exec_command('curl -s http://localhost:8080/agents/health', timeout=10)
stdout.channel.recv_exit_status()
print(stdout.read().decode('utf-8', errors='replace'))

print("\n=== 4. Web HTTP status ===")
stdin, stdout, stderr = ssh.exec_command('curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/', timeout=10)
stdout.channel.recv_exit_status()
print(stdout.read().decode('utf-8', errors='replace'))

print("\n=== 5. DeepSeek generate-task-config ===")
payload = json.dumps({
    "taskId": "test_001",
    "taskName": "电商评论情感分类",
    "instruction": "根据用户评论判断情感倾向",
    "sampleData": [{"comment": "质量很好", "orderId": "ORD-001"}],
    "traceId": "test_trace"
}, ensure_ascii=False)

cmd = f"curl -s -X POST http://localhost:8080/agents/generate-task-config -H 'Content-Type: application/json' -d '{payload}'"
stdin, stdout, stderr = ssh.exec_command(cmd, timeout=90)
ec = stdout.channel.recv_exit_status()
result = stdout.read().decode('utf-8', errors='replace')
print(result[:2000])
print(f"exit: {ec}")

ssh.close()
print("\nDone.")
