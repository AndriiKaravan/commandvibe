import 'package:commandvibe/features/photos/data/photos_models.dart';
import 'package:flutter/material.dart';

/// Swipes sideways between the photos of one day, starting on [initialMemberId]'s.
class PhotoPager extends StatefulWidget {
  const PhotoPager({
    super.key,
    required this.items,
    required this.initialMemberId,
    required this.pageBuilder,
    this.onPageChanged,
  });

  final List<SubmissionItem> items;
  final String initialMemberId;
  final Widget Function(BuildContext context, SubmissionItem item) pageBuilder;
  final void Function(SubmissionItem item)? onPageChanged;

  @override
  State<PhotoPager> createState() => _PhotoPagerState();
}

class _PhotoPagerState extends State<PhotoPager> {
  late final PageController _controller = PageController(
    initialPage: _startIndex,
  );

  int get _startIndex {
    final index = widget.items.indexWhere(
      (item) => item.memberId == widget.initialMemberId,
    );
    return index < 0 ? 0 : index;
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => PageView.builder(
    controller: _controller,
    itemCount: widget.items.length,
    onPageChanged: (index) => widget.onPageChanged?.call(widget.items[index]),
    itemBuilder: (context, index) =>
        widget.pageBuilder(context, widget.items[index]),
  );
}
