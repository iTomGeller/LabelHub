"""Repair Flyway failed migration and redeploy API if needed."""
import paramiko
import time

HOST = "8.146.231.216"
USER = "root"
PASSWORD = "POIUlkjh123@"
REPO_DIR = "/opt/labelhub-a"
BRANCH = "feature/member-a-task-config"


def run(ssh, cmd, timeout=120):
    print(f">>> {cmd}")
    _, stdout, stderr = ssh.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    if out:
        print(out)
    if err:
        print(err)
    return out + err


def main():
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(HOST, username=USER, password=PASSWORD, timeout=15)

    run(ssh, f"cd {REPO_DIR} && git fetch origin && git reset --hard origin/{BRANCH}")
    run(
        ssh,
        "docker exec labelhub_a-mysql-1 mysql -uroot -plabelhub-root labelhub "
        "-e \"SELECT installed_rank, version, success, description FROM flyway_schema_history ORDER BY installed_rank;\"",
    )
    run(
        ssh,
        "docker exec labelhub_a-mysql-1 mysql -uroot -plabelhub-root labelhub "
        "-e \"DELETE FROM flyway_schema_history WHERE success = 0; "
        "UPDATE flyway_schema_history SET checksum = 1280805841 WHERE version = '3';\"",
    )
    run(ssh, f"cd {REPO_DIR}/deploy && docker compose -p labelhub_a up -d --build api 2>&1", timeout=600)
    print("Waiting 20s for API restart...")
    time.sleep(20)
    run(ssh, "docker logs labelhub_a-api-1 2>&1 | tail -30")
    run(ssh, "curl -sf http://127.0.0.1:8080/agents/health")
    ssh.close()


if __name__ == "__main__":
    main()
