import subprocess
import sys

def run(params):
    cmd = params.get("command")
    if not cmd:
        return "Missing command"
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    return result.stdout.strip() or result.stderr.strip()

if __name__ == "__main__":
    # Enable direct execution for debug/testing
    command = " ".join(sys.argv[1:]) or "echo test"
    output = run({"command": command})
    print(output)
