"""Deploy LabelHub A to ECS via SSH (paramiko)."""
import paramiko
import time
import sys
import io

if hasattr(sys.stdout, "buffer"):
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

HOST = "8.146.231.216"
USER = "root"
PASSWORD = "POIUlkjh123@"
REPO_DIR = "/opt/labelhub-a"
BRANCH = "feature/member-a-task-config"

def run(ssh, cmd, label="", timeout=900):
    if label:
        print(f"\n{'='*40} {label}")
    print(f">>> {cmd}")

    transport = ssh.get_transport()
    channel = transport.open_session()
    channel.settimeout(timeout)
    channel.exec_command(cmd)

    output = b""
    while True:
        if channel.recv_ready():
            chunk = channel.recv(4096)
            if chunk:
                output += chunk
                sys.stdout.write(chunk.decode(errors="replace"))
                sys.stdout.flush()
        if channel.exit_status_ready():
            while channel.recv_ready():
                chunk = channel.recv(4096)
                output += chunk
                sys.stdout.write(chunk.decode(errors="replace"))
            break
        time.sleep(0.5)

    code = channel.recv_exit_status()
    channel.close()
    print(f"\nEXIT: {code}")
    return code, output.decode(errors="replace")

def main():
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(HOST, username=USER, password=PASSWORD, timeout=15)
    print(f"Connected to {HOST}")

    run(ssh, f"cd {REPO_DIR} && git fetch origin && git reset --hard origin/{BRANCH}", "PULL")

    run(ssh, f"cd {REPO_DIR}/deploy && docker compose -p labelhub_a up -d --build 2>&1", "BUILD", timeout=600)

    print("\nWaiting 15s for services to start...")
    time.sleep(15)

    run(ssh, "curl -sf http://127.0.0.1:8080/agents/health || echo 'API NOT READY'", "VERIFY API")
    run(ssh, "curl -sf -o /dev/null -w '%{http_code}' http://127.0.0.1:3000/ || echo 'WEB NOT READY'", "VERIFY WEB")

    ssh.close()
    print(f"\n{'='*40} ALL DONE")

if __name__ == "__main__":
    main()
