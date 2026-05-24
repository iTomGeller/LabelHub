"""Deploy LabelHub A to ECS via SSH (paramiko)."""
import paramiko
import sys

HOST = "8.146.231.216"
USER = "root"
PASSWORD = "POIUlkjh123@"
REPO_DIR = "/opt/labelhub-a"
BRANCH = "feature/member-a-task-config"

def run(ssh, cmd, label=""):
    if label:
        print(f"{'='*40} {label}\n")
    print(f">>> {cmd}")
    stdin, stdout, stderr = ssh.exec_command(cmd, timeout=300)
    out = stdout.read().decode()
    err = stderr.read().decode()
    code = stdout.channel.recv_exit_status()
    if out.strip():
        print(out.rstrip())
    if err.strip():
        print(f"STDERR: {err.rstrip()}")
    print(f"\nEXIT: {code}")
    return code, out, err

def main():
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(HOST, username=USER, password=PASSWORD, timeout=15)
    print(f"Connected to {HOST}\n")

    run(ssh, f"cd {REPO_DIR} && git fetch origin && git reset --hard origin/{BRANCH}", "PULL")

    build_cmd = (
        f"cd {REPO_DIR}/deploy && "
        "export COMPOSE_ANSI=never && export BUILDKIT_PROGRESS=plain && "
        "docker compose -p labelhub_a up -d --build api web 2>&1 | tail -20"
    )
    run(ssh, build_cmd, "BUILD")

    run(ssh, "sleep 10 && curl -sf http://127.0.0.1:8080/agents/health", "VERIFY API")
    run(ssh, "curl -sf http://127.0.0.1:3000/ | head -c 200", "VERIFY WEB")

    ssh.close()
    print(f"\n{'='*40} ALL DONE")

if __name__ == "__main__":
    main()
