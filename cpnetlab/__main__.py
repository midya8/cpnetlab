import json, sys
from . import analyze, verify, analyze_scopes, verify_scopes


def main():
    try:
        if len(sys.argv) != 3 or sys.argv[1] not in [
            "analyze",
            "verify",
            "scopes",
            "verify-scopes",
        ]:
            raise ValueError(
                "Usage: cpnetlab analyze|verify|scopes|verify-scopes file.json"
            )
        with open(sys.argv[2]) as f:
            value = json.load(f)
        command = sys.argv[1]
        if command in ["verify", "verify-scopes"]:
            checker = verify_scopes if command == "verify-scopes" else verify
            if not checker(value):
                raise ValueError("Evidence rejected")
            print("Evidence accepted")
        else:
            print(
                json.dumps(
                    (analyze_scopes if command == "scopes" else analyze)(value),
                    indent=2,
                )
            )
    except (ValueError, OSError, TypeError) as e:
        print(str(e), file=sys.stderr)
        sys.exit(2)


if __name__ == "__main__":
    main()
