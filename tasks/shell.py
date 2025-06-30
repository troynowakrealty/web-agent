import subprocess

def run(params):
    cmd = params.get('command')
    if not cmd:
        return 'Missing command'
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    return result.stdout or result.stderr
