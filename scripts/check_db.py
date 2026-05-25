import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect("8.146.231.216", username="root", password="POIUlkjh123@", timeout=15)
cmd = (
    "docker exec labelhub_a-mysql-1 mysql -uroot -plabelhub labelhub "
    "-e \"DESCRIBE business_nodes; SELECT version, success FROM flyway_schema_history ORDER BY installed_rank;\""
)
_, stdout, stderr = ssh.exec_command(cmd)
print(stdout.read().decode("utf-8", errors="replace"))
print(stderr.read().decode("utf-8", errors="replace"))
ssh.close()
