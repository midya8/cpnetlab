import json, sys
from . import analyze, verify


def main():
    try:
        if len(sys.argv) != 3 or sys.argv[1] not in ["analyze", "verify"]:
            raise ValueError("Usage: cpnetlab analyze|verify file.json")
        with open(sys.argv[2]) as f:
            value = json.load(f)
        if sys.argv[1] == "verify":
            if not verify(value):
                raise ValueError("Evidence rejected")
            print("Evidence accepted")
        else:
            print(json.dumps(analyze(value), indent=2))
    except (ValueError, OSError, TypeError) as e:
        print(str(e), file=sys.stderr)
        sys.exit(2)


if __name__ == "__main__":
    main()
