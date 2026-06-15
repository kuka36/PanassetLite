REPO="kuka36/PanassetLite"
gh api --paginate "repos/$REPO/actions/runs?per_page=100" \
  --jq '.workflow_runs[].id' | while read -r id; do
  echo "Deleting $id"
  gh api -X DELETE "repos/$REPO/actions/runs/$id"
done