/**
 * @desc    Chuyển đổi mảng danh mục phẳng (flat) thành cây phân cấp (nested tree)
 * @param   {Array}  categories  - Mảng các object category từ MongoDB (dạng plain object)
 * @param   {*}      parentId    - ID của node cha hiện tại (null = lấy các node gốc)
 * @returns {Array}              - Mảng các category dạng tree lồng nhau
 *
 * @example
 * Input (flat):
 * [
 *   { _id: '1', name: 'Khung Avatar', parentId: null },
 *   { _id: '2', name: 'Khung Lửa',   parentId: '1'  },
 *   { _id: '3', name: 'Khung Nước',  parentId: '1'  },
 *   { _id: '4', name: 'Khung Neon',  parentId: '2'  },
 * ]
 *
 * Output (tree):
 * [
 *   {
 *     _id: '1', name: 'Khung Avatar', parentId: null,
 *     children: [
 *       {
 *         _id: '2', name: 'Khung Lửa', parentId: '1',
 *         children: [
 *           { _id: '4', name: 'Khung Neon', parentId: '2', children: [] }
 *         ]
 *       },
 *       { _id: '3', name: 'Khung Nước', parentId: '1', children: [] }
 *     ]
 *   }
 * ]
 */
const buildCategoryTree = (categories, parentId = null) => {
  return categories
    .filter((cat) => {
      // So sánh cả trường hợp parentId là ObjectId hoặc string
      const catParent = cat.parentId ? cat.parentId.toString() : null;
      const targetParent = parentId ? parentId.toString() : null;
      return catParent === targetParent;
    })
    .map((cat) => ({
      ...cat,
      // Đệ quy lồng các category con bên trong
      children: buildCategoryTree(categories, cat._id)
    }));
};

/**
 * @desc    Lấy danh sách ID của tất cả các category con (đệ quy) của một category cha
 * @param   {Array}  categories  - Mảng các plain object category từ DB
 * @param   {string} parentId    - ID của category cha cần tìm con
 * @returns {Array}              - Mảng các _id của tất cả category con (tất cả cấp)
 *
 * @example: Dùng để xóa toàn bộ cây con khi xóa danh mục cha
 */
const getAllDescendantIds = (categories, parentId) => {
  const directChildren = categories.filter(
    (cat) => cat.parentId && cat.parentId.toString() === parentId.toString()
  );

  let allDescendantIds = directChildren.map((cat) => cat._id);

  for (const child of directChildren) {
    const subDescendants = getAllDescendantIds(categories, child._id);
    allDescendantIds = allDescendantIds.concat(subDescendants);
  }

  return allDescendantIds;
};

module.exports = {
  buildCategoryTree,
  getAllDescendantIds
};
